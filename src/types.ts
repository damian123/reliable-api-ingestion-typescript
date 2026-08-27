export type ShipmentEventType = "shipment.created" | "shipment.updated" | "shipment.delivered";

export interface CarrierEvent {
  eventId: string;
  shipmentId: string;
  type: ShipmentEventType;
  occurredAt: string;
  location?: string;
}

export interface DeliveryRecord {
  deliveryId: string;
  receivedAt: string;
  raw: unknown;
  status: "received" | "accepted" | "duplicate" | "quarantined" | "processed";
  eventId?: string;
  reason?: string;
}

export interface AuditRecord {
  action: "quarantined" | "replayed" | "processed";
  deliveryId: string;
  eventId?: string;
  reason: string;
  at: string;
}

export interface IngestionOutcome {
  deliveryId: string;
  eventId?: string;
  status: DeliveryRecord["status"];
  attempts: number;
  reason?: string;
}
