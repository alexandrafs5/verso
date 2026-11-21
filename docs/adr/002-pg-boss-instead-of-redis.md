# ADR-002: pg-boss instead of Redis + BullMQ

Status: Accepted

## Context

Background jobs are needed for imports, email, push and maintenance. BullMQ needs Redis, which means one more service to host on a free tier.

## Decision

Use pg-boss, a queue stored in the existing Postgres database, behind a `JobQueue` interface.

## Consequences

- One fewer service. Jobs can be enqueued in the same transaction as the data change.
- pg-boss polls Postgres. At this scale the load is acceptable. Polling interval is 10 s to keep Neon compute low.
- The `JobQueue` interface allows a later swap to BullMQ.
