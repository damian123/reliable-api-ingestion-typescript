import type { AuditRecord, CarrierEvent, DeliveryRecord } from "./types.js";

export class InMemoryIngestionStore {
  readonly deliveries = new Map<string, DeliveryRecord>();
  readonly events = new Map<string, CarrierEvent>();
  readonly completedEffects = new Set<string>();
  readonly audit: AuditRecord[] = [];

  persistDelivery(delivery: DeliveryRecord): void {
    if (this.deliveries.has(delivery.deliveryId)) {
      throw new Error(`Delivery ${delivery.deliveryId} already exists`);
    }
    this.deliveries.set(delivery.deliveryId, delivery);
  }

  updateDelivery(deliveryId: string, update: Partial<DeliveryRecord>): DeliveryRecord {
    const existing = this.deliveries.get(deliveryId);
    if (!existing) throw new Error(`Unknown delivery ${deliveryId}`);
    const updated = { ...existing, ...update };
    this.deliveries.set(deliveryId, updated);
    return updated;
  }

  recordAudit(record: AuditRecord): void {
    this.audit.push(record);
  }
}
