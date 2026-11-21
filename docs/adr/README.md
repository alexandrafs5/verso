# Architecture decision records

Short records of the decisions that shape Verso. Each file has context, decision and consequences. Details live in `ARCHITECTURE.md`.

| ADR | Decision |
| --- | --- |
| [001](001-free-tier-only-infrastructure.md) | Free-tier-only infrastructure |
| [002](002-pg-boss-instead-of-redis.md) | pg-boss instead of Redis + BullMQ |
| [003](003-same-origin-api-proxy.md) | Same-origin API proxy through Next.js |
| [004](004-works-editions-lazy-persistence.md) | Works/editions catalog with lazy persistence |
| [005](005-ratings-stored-as-0-100.md) | Ratings stored as 0-100 |
| [006](006-three-level-visibility.md) | Three-level visibility with inheritance |
| [007](007-pwa-instead-of-native-app.md) | PWA instead of a native app |
| [008](008-email-over-https.md) | Email over HTTPS (Brevo) |
| [009](009-external-cron-scheduling.md) | External cron for scheduling |
| [010](010-modular-monolith-pure-domain.md) | Modular monolith with pure domain classes |

New decisions: add the next number, status `Accepted`. To change a decision, add a new ADR that supersedes the old one.
