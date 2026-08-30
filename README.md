# Reliable API ingestion

Move shipment updates from a rate-limited carrier API into an internal store without duplicating side effects when webhooks and polls arrive late, twice, or out of order.

Portfolio project using fictional data. It is not connected to an employer, client, or production system.

![Architecture](portfolio/architecture.png)

## Capabilities

- Persist each delivery before processing so a crash after accept cannot lose the event.
- Deduplicate side effects with a stable event ID while still recording every delivery attempt.
- Normalize valid payloads into a typed domain model and quarantine permanent failures with a reason.
- Retry transient failures (including rate limits) with bounded exponential backoff and jitter.
- Let an operator replay a quarantined event, and report source IDs that polling expected but the store never received.

## Run

```bash
npm ci
npm run typecheck
npm test
npm run demo
```

The demo prints processed, duplicate, quarantined, retry, reconciliation, and audit outcomes as structured JSON.

## Verification

Six Vitest cases cover the paths above. There is no GitHub Actions workflow in this repository yet.

![Verified results](portfolio/verified-results.png)

Vector copies of the diagrams live next to the PNGs in `portfolio/`.

## Design

- The store and processor are explicit adapters. PostgreSQL and a production queue can replace the in-memory versions without changing ingestion policy.
- Repeating the same webhook five times still creates one business event. Restarting after persistence but before completion does not fire the side effect twice.
- A malformed payload is quarantined and does not block later records. Replay requires an auditable reason and only applies to quarantined deliveries.

```text
src/validation.ts  runtime validation and normalization
src/store.ts       persistence boundary and audit records
src/processor.ts   bounded retry policy and failure classification
src/ingestion.ts   deduplication, quarantine, replay, and reconciliation
```

## Limitations

In-memory adapters, no real carrier credentials, no multi-region claims. See [LIMITATIONS.md](LIMITATIONS.md).

## License

[MIT](LICENSE)
