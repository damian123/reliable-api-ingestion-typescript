import { describe, expect, it } from "vitest";

import { IngestionService } from "../src/ingestion.js";
import { ResilientProcessor, TransientProcessingError } from "../src/processor.js";
import { InMemoryIngestionStore } from "../src/store.js";
import type { CarrierEvent } from "../src/types.js";

const validEvent: CarrierEvent = {
  eventId: "evt-1",
  shipmentId: "shipment-1",
  type: "shipment.updated",
  occurredAt: "2026-08-24T09:00:00Z",
};

function createService(handler: (event: CarrierEvent, attempt: number) => Promise<void>) {
  const store = new InMemoryIngestionStore();
  const processor = new ResilientProcessor(handler, async () => undefined, () => 0);
  return { store, service: new IngestionService(store, processor) };
}

describe("reliable API ingestion", () => {
  it("records every delivery but applies one side effect for repeated webhooks", async () => {
    let effects = 0;
    const { store, service } = createService(async () => {
      effects += 1;
    });

    const outcomes = [];
    for (let index = 1; index <= 5; index += 1) {
      outcomes.push(await service.receive(`delivery-${index}`, validEvent));
    }

    expect(store.deliveries.size).toBe(5);
    expect(store.events.size).toBe(1);
    expect(effects).toBe(1);
    expect(outcomes.map((outcome) => outcome.status)).toEqual([
      "processed",
      "duplicate",
      "duplicate",
      "duplicate",
      "duplicate",
    ]);
  });

  it("retries transient rate limits with bounded exponential backoff", async () => {
    const delays: number[] = [];
    const processor = new ResilientProcessor(
      async (_event, attempt) => {
        if (attempt < 3) throw new TransientProcessingError("429 rate limit");
      },
      async (delay) => {
        delays.push(delay);
      },
      () => 0,
    );
    const service = new IngestionService(new InMemoryIngestionStore(), processor);

    const outcome = await service.receive("delivery-rate-limit", validEvent);

    expect(outcome.attempts).toBe(3);
    expect(delays).toEqual([100, 200]);
  });

  it("quarantines malformed payloads without blocking later records", async () => {
    const { store, service } = createService(async () => undefined);

    const bad = await service.receive("delivery-bad", { eventId: "bad" });
    const good = await service.receive("delivery-good", validEvent);

    expect(bad.status).toBe("quarantined");
    expect(good.status).toBe("processed");
    expect(store.audit.some((record) => record.action === "quarantined")).toBe(true);
  });

  it("does not duplicate an effect after a restart between persistence and completion", async () => {
    let effects = 0;
    const store = new InMemoryIngestionStore();
    store.persistDelivery({
      deliveryId: "delivery-restart",
      receivedAt: "2026-08-24T09:00:00Z",
      raw: validEvent,
      status: "accepted",
      eventId: validEvent.eventId,
    });
    store.events.set(validEvent.eventId, validEvent);
    store.completedEffects.add(validEvent.eventId);

    const restarted = new IngestionService(
      store,
      new ResilientProcessor(async () => {
        effects += 1;
      }),
    );
    const outcome = await restarted.processPersisted("delivery-restart", validEvent);

    expect(outcome.status).toBe("processed");
    expect(effects).toBe(0);
  });

  it("replays a corrected poison event with an audit reason", async () => {
    const { store, service } = createService(async () => undefined);
    await service.receive("delivery-poison", { eventId: "evt-poison" });

    const outcome = await service.replay(
      "delivery-poison",
      { ...validEvent, eventId: "evt-corrected" },
      "Carrier corrected the missing shipment fields",
    );

    expect(outcome.status).toBe("processed");
    expect(store.audit).toContainEqual(
      expect.objectContaining({
        action: "replayed",
        deliveryId: "delivery-poison",
        reason: "Carrier corrected the missing shipment fields",
      }),
    );
  });

  it("reports source events missing from the internal store", async () => {
    const { service } = createService(async () => undefined);
    await service.receive("delivery-1", validEvent);

    expect(service.reconcile(["evt-1", "evt-2", "evt-3"])).toEqual(["evt-2", "evt-3"]);
  });
});
