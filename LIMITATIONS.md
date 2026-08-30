# Limitations

This is a local reliability core for webhook and poll ingestion. It is not a production integration.

## Persistence and delivery

The store and processor are in-memory. They show the policy (persist first, idempotent effects, quarantine, bounded retry) without crash-safe durability, a real queue, or at-least-once worker leases.

## Data

All names and records are fictional. There are no carrier credentials, live webhooks, or production SLAs.

## Not included

- Financial reconciliation.
- Multi-region or multi-active delivery guarantees.
- Authentication of inbound webhooks beyond the demo's delivery IDs.
- Backpressure, poison-queue operations, or long-term retention.

A production path would keep the same idempotency and quarantine rules, then replace the adapters with PostgreSQL, a durable queue, signed webhook verification, and operator tooling.
