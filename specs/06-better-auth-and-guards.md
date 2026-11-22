# SPEC 06 — Better Auth and session guards (M2.1)

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-21
> **Objective:** Mount Better Auth (email + password, Google when configured) at `/api/auth/*` in the API, with the auth tables migrated and `SessionGuard`, `AdminGuard` and `@CurrentUser()` available to every module.

## Why this spec exists

M2.1 is the first task that adds real tables and the first one that mounts a third-party HTTP handler inside NestJS. Better Auth needs the raw request body, so it cannot go through Nest's default body parser. Email sending (M2.3), the extended `User` fields (M2.2) and rate limiting (M2.6) are separate tasks. This spec leaves clean seams for them: a logging email stub, a `role` column only, and no throttler.

## Scope

**In:**

- Dependencies in `apps/api`: `better-auth` and `uuid` (UUID v7 ids for auth tables, matching ARCHITECTURE §5.3).
- Prisma models `User`, `Session`, `Account`, `Verification` plus `User.role` enum `Role` (`USER`, `ADMIN`, default `USER`). One forward-only migration.
- `apps/api/src/modules/auth/auth.ts`: `createAuth(prisma, config)` returns the Better Auth instance. Email + password enabled (minimum 8 characters, ARCHITECTURE §10). Google enabled only when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both set. `user.additionalFields.role` exposed as read-only (not settable at sign-up).
- `apps/api/src/modules/auth/auth.module.ts` and `auth.controller.ts` (or a middleware registered in the module) that forwards `/api/auth/*` to Better Auth through `toNodeHandler`. Body parsing is disabled for that path only.
- `SessionGuard`: resolves the session with `auth.api.getSession({ headers })`, sets `req.user` and `req.session`, throws 401 with code `UNAUTHENTICATED` (problem+json) when missing.
- `AdminGuard`: runs after `SessionGuard`; throws 403 with code `FORBIDDEN` when `user.role !== 'ADMIN'`.
- `@CurrentUser()` param decorator returning `req.user`.
- Logging stub for `sendVerificationEmail` and `sendResetPassword` hooks (logs the recipient and the URL at `info` in non-production only). Email verification is not enforced yet.
- Env vars in `.env.example` for the API: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `WEB_ORIGIN`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (ARCHITECTURE §13). Validated at startup; a missing `BETTER_AUTH_SECRET` fails the boot.
- Integration tests with real Postgres (see Acceptance criteria).

**Out of scope (for future specs):**

- `username`, `bio`, settings fields, `onboardingCompletedAt` on `User` (M2.2).
- `UsernamePolicy` (M2.2).
- `EmailProvider`, Mailpit and Brevo implementations, localized auth emails, enforcing verified email (M2.3).
- Sign-in, sign-up, verify and reset screens and `auth-client.ts` in the web app (M2.4).
- `GET/PATCH /v1/me` and onboarding endpoints (M2.5).
- Rate limiting and the full sign-up/sign-in/guard test matrix (M2.6).
- `Origin` check for non-GET requests on our own routes (ARCHITECTURE §10). Better Auth's own origin checks apply to `/api/auth/*` only. Decided with M2.6.
- Mounting the web proxy changes. The `/api/:path*` rewrite from SPEC 02 already covers `/api/auth/*`.
- Real Google OAuth round trip (verified manually in M12.5).

## Data model

Prisma additions (Better Auth core schema, generated with the Better Auth CLI and then hand-aligned to project conventions):

```prisma
enum Role {
  USER
  ADMIN
}

model User {
  id            String    @id
  email         String    @unique
  emailVerified Boolean   @default(false)
  name          String
  image         String?
  role          Role      @default(USER)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
  sessions      Session[]
  accounts      Account[]
}

// Session, Account, Verification: Better Auth defaults.
// Session: id, token (unique), expiresAt, ipAddress, userAgent, userId (cascade).
// Account: id, accountId, providerId, userId (cascade), tokens, password, timestamps.
// Verification: id, identifier, value, expiresAt, timestamps.
```

Guard contract (local to `apps/api/src/modules/auth`):

```ts
type AuthUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  emailVerified: boolean;
  role: 'USER' | 'ADMIN';
};
// SessionGuard attaches: req.user: AuthUser, req.session: { id: string; expiresAt: Date }
```

Conventions:

- Ids are UUID v7 strings, produced through Better Auth `advanced.database.generateId`.
- Timestamps are `timestamptz` in UTC. Model names are `PascalCase`, columns `camelCase`, enum values `UPPER_SNAKE`.
- Cookie: `HttpOnly; Secure; SameSite=Lax`, first-party through the web proxy. `BETTER_AUTH_URL` is the web origin, not the API origin.
- Auth errors from our guards use problem+json via the existing `ProblemJsonFilter`. Errors from `/api/auth/*` keep Better Auth's own JSON shape.
- `role` can only be changed in the database (seed or SQL) until the admin flow exists.

## Implementation plan

1. Add `better-auth` and `uuid` to `apps/api`. Add the auth env vars to `.env.example` and a Zod env schema that fails boot on a missing `BETTER_AUTH_SECRET`. Verify: `pnpm --filter api typecheck`, app still boots.
2. Add the models and `Role` enum to `schema.prisma`; run `pnpm db:migrate` to create the migration. Verify: migration applies on a clean database and `pnpm db:seed` still runs.
3. Create `auth.ts` (`createAuth`) with email + password, conditional Google, `role` field, UUID v7 `generateId` and the logging email stub. Verify: typecheck.
4. Create `AuthModule` and mount the Better Auth handler at `/api/auth/*` with body parsing off for that path only (JSON parsing still works on every other route). Verify: `POST /api/auth/sign-up/email` against the local stack returns a session cookie, and `GET /health` and an existing JSON route still parse bodies.
5. Add `SessionGuard`, `@CurrentUser()` and the `AuthUser` type; export them from `AuthModule`. Verify: typecheck.
6. Add `AdminGuard`. Verify: typecheck.
7. Add integration tests with a temporary test-only controller (`GET /api/test/me`, `GET /api/test/admin`) registered only in the test module. Verify: `pnpm --filter api test`.
8. Tick M2.1 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [ ] `pnpm db:migrate` on an empty database creates `User`, `Session`, `Account`, `Verification` and the `Role` enum; new users get `role = USER`.
- [ ] The API fails to start with a clear error when `BETTER_AUTH_SECRET` is missing.
- [ ] `POST /api/auth/sign-up/email` with a valid email and an 8+ character password returns 200 and sets an `HttpOnly` cookie; the created user has a UUID v7 id.
- [ ] Sign-up with a password shorter than 8 characters is rejected (4xx) and creates no user.
- [ ] Sign-up body cannot set `role`: a request with `role: "ADMIN"` produces a `USER`.
- [ ] `POST /api/auth/sign-in/email` with the right password returns a session cookie; with a wrong password it returns 401 and no cookie.
- [ ] `GET /api/auth/get-session` with the cookie returns the user; without it returns no session.
- [ ] `POST /api/auth/sign-out` invalidates the session: the same cookie then fails `SessionGuard`.
- [ ] A route with `SessionGuard` returns 401 problem+json with `code: "UNAUTHENTICATED"` without a cookie and 200 with a valid one.
- [ ] `@CurrentUser()` returns the signed-in user's `id`, `email` and `role`.
- [ ] A route with `SessionGuard` and `AdminGuard` returns 403 problem+json with `code: "FORBIDDEN"` for a `USER` and 200 for an `ADMIN` (role set directly in the test database).
- [ ] An expired session (`expiresAt` in the past) fails `SessionGuard` with 401.
- [ ] With `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` unset, `POST /api/auth/sign-in/social` for `google` fails with a provider-not-found error; with both set (dummy values), it returns a redirect URL to Google.
- [ ] Other routes still accept JSON bodies and the Zod validation pipe still runs on them (existing integration tests pass).
- [ ] The sign-up verification email hook logs the verification URL and does not send mail or throw.
- [ ] No auth secrets or user data appear in logs at `info` in production mode (the stub logs nothing when `NODE_ENV=production`).
- [ ] `.env.example` lists every new variable.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] The M2.1 checkbox in `ROADMAP.md` is ticked in the same PR.

UI states: N/A, this spec touches no screen or component.

## Decisions

- **Yes:** migration holds Better Auth core plus `User.role`. `AdminGuard` is then testable against a real column now; M2.2 adds the remaining `User` fields in a second migration.
- **Yes:** Better Auth runs on `toNodeHandler` with the existing Express adapter. No new auth-wrapper package.
- **No:** `@thallesp/nestjs-better-auth`. One more dependency for a small amount of glue code.
- **Yes:** email hooks are a logging stub. M2.3 replaces them with `EmailProvider`. Verification is not enforced until then, so sign-up works end to end today.
- **No:** `EmailProvider` interface now. It belongs to M2.3 and defining it here would split that design across two PRs.
- **Yes:** Google provider is registered only when both env vars are set. Local dev and CI need no Google project.
- **Yes:** guards live in `modules/auth` and are exported by `AuthModule`; other modules import the module, not the guard files directly (cross-module rule from CLAUDE.md).
- **Yes:** guard tests use a test-only controller and sign up through the real `/api/auth` handler on real Postgres. No Prisma mocks (CLAUDE.md).
- **Yes:** `role` is `input: false` in Better Auth additional fields so a client cannot self-promote.
- **Yes:** UUID v7 ids via the `uuid` package (new dependency, one-line reason for the PR: Node has no native v7 and ARCHITECTURE §5.3 requires it for every table).
- **Yes:** the smoke-level test set here; the full sign-up/sign-in/guard matrix stays in M2.6.
- **No:** `@nestjs/throttler` here. M2.6 owns it.
- **Yes:** quick definition for the test scope and the UUID v7 approach without asking. The test scope follows the ROADMAP split between M2.1 and M2.6. The `uuid` choice and the test-only controller approach are mine and unconfirmed.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Better Auth needs the raw body; Nest's default parser consumes it first | Create the app with the default parser disabled and re-register `json()` and `urlencoded()` for every path except `/api/auth`; step 4 verifies other routes still parse bodies |
| Better Auth Prisma adapter with Prisma 7 and the custom client output in `src/generated/prisma` | Pass the existing `PrismaService` instance to `prismaAdapter`; if the adapter rejects it, stop and report instead of switching ORM access |
| Cookies and redirects depend on `BETTER_AUTH_URL` being the web origin | Document in `.env.example`; local default `http://localhost:3000` so the Next.js proxy path matches production |
| Verification not enforced until M2.3 lets unverified users in | Accepted for the window between M2.1 and M2.3; no feature that needs verified email exists yet |
| Better Auth upgrades change generated schema | Pin the version; migration is forward-only and reviewed by hand after generation |

## What is **not** in this spec

- `username`, settings fields, onboarding state or `UsernamePolicy`.
- `EmailProvider`, real email delivery or enforced verification.
- Any web screen or `auth-client.ts`.
- `/v1/me` endpoints.
- Rate limiting or the full auth test matrix.
- Admin endpoints or any way to promote a user besides editing the database.
