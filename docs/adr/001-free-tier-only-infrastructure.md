# ADR-001: Free-tier-only infrastructure

Status: Accepted

## Context

Verso is a portfolio project with about 5 users. It must not require a credit card or paid services.

## Decision

Run everything on free tiers: Vercel Hobby, Render Free, Neon Free, Supabase Free, Brevo Free, GitHub Actions on a public repo and Open Library. Put every external service behind an interface (`EmailProvider`, `FileStorage`, `JobQueue`, `CatalogProvider`, `PushSender`).

## Consequences

- Render Free sleeps, so the app has cold starts. The UI shows a waking state and retries.
- Scheduling cannot rely on in-process timers (see ADR-009).
- Free allowances can change. Interfaces keep a provider swap to one class.
- No Redis, WebSockets or native app.
