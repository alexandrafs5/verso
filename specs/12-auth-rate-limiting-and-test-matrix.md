# SPEC 12 — Auth rate limiting and test matrix (M2.6)

> **Status:** Implemented
> **Depends on:** SPEC 06, SPEC 08, SPEC 09
> **Date:** 2026-11-22
> **Objective:** Limit `/api/auth/*` to 10 requests per minute per IP per path with Better Auth's built-in rate limiter, and close the sign-up, sign-in and guard integration test matrix.

## Why this spec exists

`/api/auth/*` is mounted as a raw Express middleware (`AuthHandlerMiddleware`), so Nest guards never run on it. `@nestjs/throttler` (ARCHITECTURE §10) would need custom middleware to cover it. Better Auth already ships a rate limiter that runs inside its own handler, so this spec uses it. SPEC 09 accepted the mail-bombing risk (duplicate sign-ups, forgot-password, resend-verification) until this task.

## Scope

**In:**

- `rateLimit` option in `createAuth` (`apps/api/src/modules/auth/auth.ts`): `enabled` from env, `window: 60`, `max` from env (default 10), memory storage.
- Override the built-in per-path special rules of Better Auth (for example sign-in and password routes) so every limited auth route uses the same 10 per 60 seconds.
- Exempt session reads (`GET /api/auth/get-session`) from the limit, because the web app calls it on normal navigation.
- Client IP from `x-forwarded-for` (`advanced.ipAddress.ipAddressHeaders`), so the limit is per client behind Render's proxy and not one shared bucket.
- Env in `apps/api/src/config/auth-env.ts` and `.env.example`: `AUTH_RATE_LIMIT_ENABLED` (default `true`, also in development) and `AUTH_RATE_LIMIT_MAX` (default `10`).
- New `auth-rate-limit.integration.test.ts` for the 429 behavior.
- `auth.integration.test.ts` and `users.integration.test.ts` set `AUTH_RATE_LIMIT_ENABLED=false`, so their many sign-ups from one IP do not trip the limit.
- Fill gaps in the sign-up, sign-in and guard integration cases listed in the acceptance criteria. Cases that already exist are not duplicated.
- Update `ARCHITECTURE.md` §10 (rate limiting line) and env table, and tick M2.6 in `ROADMAP.md`. Add a ROADMAP item for the `/v1` throttler and `/v1/me` limits, and the `x-forwarded-for` check in M12.5.

**Out of scope (for future specs):**

- `@nestjs/throttler` and limits on `/v1/*` (search 60/min/user, writes 120/min/user). It lands with the first endpoint that needs it, as its own task.
- Limits on `/v1/me` routes (username availability, avatar upload URL). They move to that same throttler task.
- Persistent or shared rate limit storage (database or Redis). One API instance, in-memory is enough (ARCHITECTURE §10).
- Rewriting the 429 body as problem+json. The web only checks `status === 429`.
- Account lockout, CAPTCHA, or per-email limits.

## Data model

This feature introduces no database changes (memory storage, no `rateLimit` table). New env variables:

```ts
AUTH_RATE_LIMIT_ENABLED: boolean; // default true
AUTH_RATE_LIMIT_MAX: number; // default 10, requests per 60 s per IP per path
```

Conventions:

- The window is fixed at 60 seconds and is not configurable.
- Better Auth counts per IP and per path, not per IP across all paths. "10/min/IP" means 10 per route.
- A limited request returns `429` with the `X-Retry-After` header set by Better Auth.

## Implementation plan

1. Add `AUTH_RATE_LIMIT_ENABLED` and `AUTH_RATE_LIMIT_MAX` to `auth-env.ts` with a unit test (defaults, `false` string, invalid number fails boot) and to `.env.example`. Verify: `pnpm --filter api test`.
2. Add `rateLimit` and `advanced.ipAddress.ipAddressHeaders` to `createAuth`. Read the built-in special rules of `better-auth@1.7.27` and override each with the same window and max through `customRules`; set the `get-session` path to no limit. Set `AUTH_RATE_LIMIT_ENABLED=false` in `auth.integration.test.ts`. Verify: existing auth tests pass.
3. Create `auth-rate-limit.integration.test.ts` (separate app instance, limit enabled, `max` set low through env where useful). Cover the cases in the acceptance criteria. Verify: `pnpm --filter api test`.
4. Audit `auth.integration.test.ts` against the sign-up, sign-in and guard criteria below. Add only the missing cases. Verify: `pnpm --filter api test`.
5. Update `ARCHITECTURE.md` §10 and tick M2.6 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

**Rate limiting**

- [x] With the limit enabled, the 11th `POST /api/auth/sign-in/email` within 60 seconds from the same IP returns 429.
- [x] The same holds for sign-up, password reset request (`/request-password-reset`) and resend-verification (`/send-verification-email`) routes. Overridden routes without their own 429 test (`/change-password`, `/change-email`, `/email-otp/*`, legacy `/forget-password`) share the same `customRules` list and are accepted as untested.
- [x] The first 10 requests are not limited.
- [x] Two different IPs (different `x-forwarded-for`) have separate counters.
- [x] A 429 response carries an `X-Retry-After` header.
- [x] `GET /api/auth/get-session` is not limited, even after more than 10 calls.
- [x] A duplicate sign-up beyond the limit sends no extra "account exists" email (the in-memory provider receives at most 10). An unverified sign-in sends a verification email (`sendOnSignIn`) and is covered by the same 10 per minute cap on `/sign-in/email`.
- [x] With `AUTH_RATE_LIMIT_ENABLED=false`, 11 requests are not limited.
- [x] Boot with defaults enables the limit in development as well (`enabled: true` is set explicitly). Proved by the `enables the limit with defaults, also with NODE_ENV=development` test.

**Sign-up**

- [x] A valid sign-up returns 200 and creates the user with `role = USER`.
- [x] A duplicate email returns the same response as a new one and creates no second user.
- [x] A password shorter than 8 characters is rejected.
- [x] An invalid email is rejected.

**Sign-in**

- [x] A correct password after verification returns 200 and sets the session cookie.
- [x] A wrong password and an unknown email return the same status and body (no account enumeration).
- [x] An unverified user gets 403.
- [x] After sign-out, the old cookie no longer opens a session.

**Guards**

- [x] `SessionGuard` returns 401 problem+json without a cookie.
- [x] `SessionGuard` returns 401 with a revoked or invalid cookie.
- [x] `AdminGuard` returns 403 for a `USER` and 200 for an `ADMIN`.
- [x] `@CurrentUser()` returns the signed-in user and never exposes the password hash.

**General**

- [x] `.env.example` lists both new variables with a comment.
- [x] `ARCHITECTURE.md` §10 says auth routes use Better Auth's rate limiter and `/v1` limits use `@nestjs/throttler` later.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] The M2.6 checkbox in `ROADMAP.md` is ticked in the same PR.

UI states: N/A, this spec touches no screen or component. The web already maps 429 to the `rateLimited` message (SPEC 09, SPEC 10).

## Decisions

- **Yes:** Better Auth built-in `rateLimit`. It runs inside the mounted handler, adds no dependency and covers every auth route, including future plugin routes.
- **No:** `@nestjs/throttler` for auth. It needs custom middleware because Nest guards do not run on `/api/auth`, and it duplicates a feature already in the library. It stays planned for `/v1`.
- **Yes:** one flat 10 per minute for all limited auth routes, as ARCHITECTURE §10 says. The built-in stricter defaults (for example sign-in) are overridden, so behavior matches the document and is simple to test.
- **No:** a stricter limit only for sign-up and forgot-password. Not needed at 5 users; the flat limit already stops mail bombing.
- **Yes:** exempt `get-session`. Without it, normal page navigation would trip the limit.
- **Yes:** `x-forwarded-for` for the client IP. Better Auth reads it by default, and without trust in a proxy header all users share one bucket on Render.
- **Yes:** `enabled: true` explicitly. The library default is off in development, which hides the behavior until production.
- **Yes:** env switch `AUTH_RATE_LIMIT_ENABLED` instead of a `NODE_ENV=test` rule. Tests state their intent: the old file disables the limit, the new file enables it.
- **Yes:** memory storage. One instance, and a restart that clears counters is acceptable.
- **No:** problem+json for 429. Better Auth owns that response and the web only reads the status.
- **Yes:** `/v1/me` limits move to the future throttler task. SPEC 11 deferred them here, but they need `@nestjs/throttler`, which this spec does not add.
- **Yes:** quick definition requested by the user ("corto"). The recommended option of each `/preflight` question was taken: mechanism, flat limit, `get-session` exemption, `x-forwarded-for`, env switch, `/v1/me` deferral. The user confirmed all six on 2026-11-22.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `x-forwarded-for` can be spoofed if Render does not replace the client value, letting an attacker rotate IPs | Check Render's header behavior at deploy (M12.5 smoke test: 11 rapid sign-ins from one machine return 429). If spoofable, switch `ipAddressHeaders` to the header the proxy sets |
| Wrong or missing client IP puts all users in one bucket | Same manual check. A shared bucket fails loud (everyone sees 429), not silent |
| Built-in special-rule paths differ in 1.7.27 from what the docs list | Step 2 reads the installed version's rules and overrides each by its real path. A test per route (criteria above) proves the override |
| Disabling the limit in the old test file hides a regression where the limiter breaks normal flows | The new file runs a sign-up, verify and sign-in flow with the limit enabled |
| Per-path counting allows more than 10 total requests per minute across routes | Accepted. The limit targets abuse of each route, not total traffic |

## What is **not** in this spec

- `@nestjs/throttler` or any limit on `/v1/*`, including `/v1/me`.
- Shared or persistent rate limit storage.
- problem+json for 429, lockout, CAPTCHA or per-email limits.
- Any web change.
