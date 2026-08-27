import { IngestionService } from "./ingestion.js";
import { ResilientProcessor, TransientProcessingError } from "./processor.js";
import { InMemoryIngestionStore } from "./store.js";

const store = new InMemoryIngestionStore();
const delays: number[] = [];
const processor = new ResilientProcessor(
  async (_event, attempt) => {
    if (attempt < 3) throw new TransientProcessingError("Carrier API rate limit");
  },
  async (delay) => {
    delays.push(delay);
  },
  () => 0,
);
const service = new IngestionService(store, processor, () => new Date("2026-08-24T00:00:00Z"));

const validEvent = {
  eventId: "evt-1001",
  shipmentId: "shipment-42",
  type: "shipment.updated",
  occurredAt: "2026-08-24T09:00:00Z",
  location: "Singapore",
};

const processed = await service.receive("delivery-1", validEvent);
const duplicate = await service.receive("delivery-2", validEvent);
const quarantined = await service.receive("delivery-3", { eventId: "evt-bad" });
const missing = service.reconcile(["evt-1001", "evt-1002"]);

console.log(
  JSON.stringify(
    {
      processed,
      duplicate,
      quarantined,
      retryDelaysMs: delays,
      missingSourceEvents: missing,
      auditRecords: store.audit,
    },
    null,
    2,
  ),
);
