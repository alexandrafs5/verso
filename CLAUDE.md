# CLAUDE.md — Verso

Verso is a personal-first reading platform ("Goodreads done right"): library, reading progress and streaks, highlights/bookmarks/notes, reviews, stats, private/public profiles. Portfolio project, ~5 users, runs entirely on free tiers.

## Read before working

- `ARCHITECTURE.md` — stack, layout, data model, domain classes, API, jobs. **Source of truth for how things are built.**
- `docs/DESIGN.md` — every screen, state, token and copy rule. **Source of truth for what the UI does and looks like.**
- `docs/design/` - visual reference exported from Claude Design. Match its look, but build with our stack and components; don’t copy its code wholesale
- `ROADMAP.md` — task order. Work on one task at a time.

If code, ARCHITECTURE.md and DESIGN.md disagree, stop and ask; don't silently pick one.

## Scope rule

**Implement only what is tagged [F1]** (and [F1.5] once F1 is done) in DESIGN.md and ROADMAP.md. Do not build [F2]–[F5] or [Future] features, tables or endpoints, even partially, unless the task says so. If a task seems to need a later-phase feature, ask.

## Commands

```bash
docker compose up -d          # Postgres 16 + Mailpit (http://localhost:8025)
pnpm install
pnpm dev                      # web :3000, api :4000 (Turborepo)
pnpm db:migrate               # prisma migrate dev
pnpm db:seed
pnpm lint && pnpm typecheck
pnpm test                     # unit + integration (needs Postgres running)
pnpm test:e2e                 # Playwright, full local stack
pnpm --filter api <script>    # run a script in one app
```

Before saying a task is done: `pnpm lint && pnpm typecheck && pnpm test` must pass.

## Conventions

**Language:** all code, comments, commits, docs and identifiers in English. UI text exists in English and Spanish through `packages/i18n` — never hardcode user-facing strings.

**Backend (apps/api):**

- Module layout: `controller → service → (domain, repository)`. Controllers: HTTP and validation only. Repositories: Prisma only. Business rules: pure classes in `domain/` with no Nest or Prisma imports.
- Cross-module access only through the other module's exported service. Side effects across modules through events.
- Every endpoint validates input with Zod schemas from `packages/shared`. Errors as problem+json with a stable `code`.
- Every read of another user's content goes through `ProfileAccessPolicy` / `VisibilityResolver`. Every mutation checks ownership.
- External services only through their interfaces (`CatalogProvider`, `JobQueue`, `EmailProvider`, `FileStorage`, `PushSender`). Tests use fakes.
- Ratings are integers 0–100. Percentages are basis points 0–10000. Dates for sessions are local dates in the user's time zone.

**Frontend (apps/web):**

- Colors, type, radii and shadows only from tokens (`styles/tokens.css`), never raw hex.
- Every screen implements default, loading (skeleton), empty and error states, in light and dark, at mobile/tablet/desktop widths.
- No emojis anywhere in the UI. Thin line icons always paired with text labels (except close, search, more, bell).
- Data fetching with TanStack Query through `lib/api-client.ts`; forms with react-hook-form + shared Zod schemas.
- Accessibility: WCAG 2.1 AA, keyboard reachable, labeled inputs, alt text on covers, respect reduced motion.

**Shared:** Zod schemas and types in `packages/shared` are the API contract. Change the schema first, then both apps.

**Naming:** files `kebab-case.ts`; classes `PascalCase`; React components `PascalCase.tsx`; DB tables `PascalCase` (Prisma models), columns `camelCase`; enums `UPPER_SNAKE`.

## Testing

- New or changed domain logic needs unit tests (Vitest) in the same PR.
- New endpoints need an integration test, including the unauthorized and forbidden cases.
- Access-control rules (private profiles, hidden books, visibility inheritance) always get tests.
- Don't mock Prisma; integration tests use the real local Postgres.

## Git workflow

- Branches: `main` only receives the final release. All approved work merges into `develop`, always via PR (never push directly to `develop` or `main`). PRs target `develop`, not `main`.
- One ROADMAP task per branch, cut from `develop`: `feat/<task-id>-short-name` (e.g. `feat/m4.2-add-to-library`).
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Small PRs. Update the ROADMAP checkbox in the same PR.
- Migrations are forward-only. Never edit a migration that's on `main`.

## Hard rules (don't)

- Don't add paid services or anything requiring a credit card. Don't add Redis, BullMQ, WebSockets or a native app.
- Don't commit secrets, `.env` files or real user data. The repo is public. Update `.env.example` when adding variables.
- Don't rely on in-process schedulers for business schedules; use the cron tick (Render Free sleeps).
- Don't send email over SMTP in production (blocked on Render Free); use `EmailProvider` (Brevo).
- Don't persist Open Library works/editions on view; only when a user adds a book.
- Don't disable lint rules or skip tests to make CI pass.
- Don't introduce new dependencies without a one-line reason in the PR description.
