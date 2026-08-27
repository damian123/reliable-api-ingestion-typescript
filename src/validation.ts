import type { CarrierEvent, ShipmentEventType } from "./types.js";

const EVENT_TYPES = new Set<ShipmentEventType>([
  "shipment.created",
  "shipment.updated",
  "shipment.delivered",
]);

export type ValidationResult =
  | { ok: true; event: CarrierEvent }
  | { ok: false; reason: string };

export function validateCarrierEvent(raw: unknown): ValidationResult {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: "Payload must be a JSON object" };
  }

  const candidate = raw as Record<string, unknown>;
  if (typeof candidate.eventId !== "string" || candidate.eventId.trim() === "") {
    return { ok: false, reason: "eventId is required" };
  }
  if (typeof candidate.shipmentId !== "string" || candidate.shipmentId.trim() === "") {
    return { ok: false, reason: "shipmentId is required" };
  }
  if (typeof candidate.type !== "string" || !EVENT_TYPES.has(candidate.type as ShipmentEventType)) {
    return { ok: false, reason: "type is not a supported shipment event" };
  }
  if (typeof candidate.occurredAt !== "string" || Number.isNaN(Date.parse(candidate.occurredAt))) {
    return { ok: false, reason: "occurredAt must be an ISO-8601 timestamp" };
  }
  if (candidate.location !== undefined && typeof candidate.location !== "string") {
    return { ok: false, reason: "location must be a string when provided" };
  }

  const event: CarrierEvent = {
    eventId: candidate.eventId,
    shipmentId: candidate.shipmentId,
    type: candidate.type as ShipmentEventType,
    occurredAt: new Date(candidate.occurredAt).toISOString(),
  };
  if (typeof candidate.location === "string") event.location = candidate.location;
  return { ok: true, event };
}
