# ADR-009: External cron for scheduling

Status: Accepted

## Context

Render Free sleeps after 15 minutes without traffic. In-process schedulers do not run while the API is asleep.

## Decision

A GitHub Actions workflow calls `POST /internal/cron/tick` every hour with a shared secret. The tick wakes the API and enqueues due jobs (reminders, cleanup, import recovery). No business schedule depends on pg-boss scheduling.

## Consequences

- Reminders have hourly granularity.
- GitHub cron can be delayed. The workflow retries because the first call may hit a cold start.
- The cron endpoint needs a secret and constant-time comparison.
