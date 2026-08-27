import { ResilientProcessor } from "./processor.js";
import { InMemoryIngestionStore } from "./store.js";
import type { CarrierEvent, IngestionOutcome } from "./types.js";
import { validateCarrierEvent } from "./validation.js";

type Clock = () => Date;

export class IngestionService {
  constructor(
    readonly store: InMemoryIngestionStore,
    private readonly processor: ResilientProcessor,
    private readonly clock: Clock = () => new Date(),
  ) {}

  async receive(deliveryId: string, raw: unknown): Promise<IngestionOutcome> {
    const receivedAt = this.clock().toISOString();
    this.store.persistDelivery({ deliveryId, receivedAt, raw, status: "received" });

    const validation = validateCarrierEvent(raw);
    if (!validation.ok) {
      this.store.updateDelivery(deliveryId, { status: "quarantined", reason: validation.reason });
      this.store.recordAudit({
        action: "quarantined",
        deliveryId,
        reason: validation.reason,
        at: this.clock().toISOString(),
      });
      return { deliveryId, status: "quarantined", attempts: 0, reason: validation.reason };
    }

    const event = validation.event;
    if (this.store.events.has(event.eventId)) {
      this.store.updateDelivery(deliveryId, { status: "duplicate", eventId: event.eventId });
      return { deliveryId, eventId: event.eventId, status: "duplicate", attempts: 0 };
    }

    this.store.events.set(event.eventId, event);
    this.store.updateDelivery(deliveryId, { status: "accepted", eventId: event.eventId });
    return this.processPersisted(deliveryId, event);
  }

  async processPersisted(deliveryId: string, event: CarrierEvent): Promise<IngestionOutcome> {
    if (this.store.completedEffects.has(event.eventId)) {
      this.store.updateDelivery(deliveryId, { status: "processed", eventId: event.eventId });
      return { deliveryId, eventId: event.eventId, status: "processed", attempts: 0 };
    }

    const result = await this.processor.process(event);
    this.store.completedEffects.add(event.eventId);
    this.store.updateDelivery(deliveryId, { status: "processed", eventId: event.eventId });
    this.store.recordAudit({
      action: "processed",
      deliveryId,
      eventId: event.eventId,
      reason: `Processed after ${result.attempts} attempt(s)`,
      at: this.clock().toISOString(),
    });
    return { deliveryId, eventId: event.eventId, status: "processed", attempts: result.attempts };
  }

  async replay(deliveryId: string, correctedRaw: unknown, reason: string): Promise<IngestionOutcome> {
    const original = this.store.deliveries.get(deliveryId);
    if (!original || original.status !== "quarantined") {
      throw new Error("Only quarantined deliveries can be replayed");
    }
    const replayDeliveryId = `${deliveryId}:replay:${this.store.audit.length + 1}`;
    this.store.recordAudit({
      action: "replayed",
      deliveryId,
      reason,
      at: this.clock().toISOString(),
    });
    return this.receive(replayDeliveryId, correctedRaw);
  }

  reconcile(sourceEventIds: readonly string[]): string[] {
    return sourceEventIds.filter((eventId) => !this.store.events.has(eventId));
  }
}
