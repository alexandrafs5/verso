# SPEC 02 — Next.js web skeleton (M0.5)

> **Status:** Approved
> **Depends on:** SPEC 01
> **Date:** 2026-11-21
> **Objective:** Get `apps/web` booting with Next.js App Router, the `/api/:path*` rewrite to the API, a TanStack Query provider and a typed `api-client` that handles the waking state and retries.

## Scope

**In:**

- Dependencies in `apps/web`: `next`, `react`, `react-dom`, `@tanstack/react-query`, `zod`, `@verso/shared` (workspace); dev: `@types/react`, `@types/react-dom`.
- `apps/web/next.config.ts`: rewrites for `/api/health` and `/api/:path*` (see Decisions).
- `apps/web/src/app/layout.tsx`, `page.tsx` and `providers.tsx` (`QueryClientProvider`).
- `apps/web/src/lib/api-client.ts`: typed fetch, Zod response parsing, `ApiError` from problem+json, waking-state marking and retries.
- `apps/web/src/lib/waking-state.ts`: tiny external store (`subscribe`, `getSnapshot`) and a `useWakingState()` hook. No UI.
- `apps/web/src/lib/query-keys.ts` with the `health` key only.
- `packages/shared/src/health.ts`: `healthResponseSchema`, exported from `index.ts`.
- `dev`, `build` and `start` scripts in `apps/web/package.json`; `.next` as a Turborepo build output.
- Demo page that calls `GET /api/health` through the proxy and shows the returned `status`.
- Tests: unit tests for `api-client` (Vitest, fake timers, mocked `fetch`).

**Out of scope (for other specs):**

- Tokens, fonts, next-themes, Tailwind and shadcn (M1.1, M1.2).
- next-intl and any user-facing copy (M1.5). The demo page shows only the raw `status` value.
- The waking-server banner (M1.6). This spec only exposes the state.
- Wake-up ping to `{API_URL}/health` on landing and sign-in (M12.1).
- Better Auth client (`auth-client.ts`) and `SessionGuard` redirects (M2).
- Security headers and CSP (later with M12.5).
- PWA, Serwist, manifest (F1.5).
- Vercel deploy (M12.5) and CI (M0.6).

## Data model

No tables. New contract in `packages/shared/src/health.ts`, exported from `index.ts`:

```ts
export const healthResponseSchema = z.object({ status: z.literal('ok') });
```

Client-side types in `apps/web/src/lib/api-client.ts`:

```ts
export class ApiError extends Error {
  status: number;
  code: ErrorCode | null; // null when the body is not valid problem+json
  problem: Problem | null;
}

export type WakingState = 'idle' | 'waking';

api.get<T>(path: string, schema: z.ZodType<T>, opts?: { signal?: AbortSignal }): Promise<T>
```

Conventions:

- Paths are relative and start with `/api` (same-origin; the rewrite does the rest).
- A response that fails `schema.parse` throws `ApiError` with `code: null`; it is never returned untyped.
- Waking threshold: 3 s. Retry budget: 75 s total. Backoff: 1 s, 2 s, 4 s, then 8 s capped.
- Retry applies to 502, 503, 504 and network errors. Non-GET requests retry only on 502 and 503, because the request never reached the app.
- `WakingState` becomes `waking` when any in-flight request passes 3 s or is being retried. It returns to `idle` when no request is in that condition.
- 4xx and 500 are never retried.

## Implementation plan

1. Add dependencies and the `dev` / `build` / `start` scripts. Update `tsconfig.json` for Next (`jsx: preserve`, Next plugin). Delete `src/placeholder.ts`. Verify: `pnpm install` and `pnpm --filter @verso/web typecheck` pass.
2. Add `healthResponseSchema` to `packages/shared` with a unit test.
3. Create `next.config.ts`, `layout.tsx` and a static `page.tsx`. Verify: `pnpm --filter @verso/web dev` serves `localhost:3000`.
4. Implement `waking-state.ts` and `api-client.ts` (fetch, parse, `ApiError`) without retries. Verify: unit tests for success, problem+json error and schema mismatch.
5. Add the retry and waking logic to `api-client.ts`. Verify: unit tests with fake timers for the 3 s mark, backoff, the 75 s budget and the non-GET rule.
6. Add `providers.tsx` (`QueryClient` with `retry: false`, because the client handles retries) and `query-keys.ts`.
7. Turn `page.tsx` into the demo: `useQuery` on `/api/health`. Verify: with the API running, the page shows `ok`; with the API stopped, the page shows an error status after the retry budget.
8. Add `.next` to Turborepo `build` outputs and confirm `pnpm build` passes for the web app.

## Acceptance criteria

- [ ] `pnpm dev` starts web on `:3000` and API on `:4000` without errors.
- [ ] `http://localhost:3000` shows the `status` value `ok` returned by `GET /api/health` through the proxy.
- [ ] `curl localhost:3000/api/health` returns `{"status":"ok"}`.
- [ ] `curl localhost:3000/api/nope` returns a 404 `application/problem+json` from the API.
- [ ] `api.get` throws `ApiError` with `code` and `problem` set when the API returns problem+json.
- [ ] `api.get` throws `ApiError` with `code: null` when the body does not match the schema.
- [ ] A request taking more than 3 s sets `WakingState` to `waking`; it returns to `idle` when the request ends.
- [ ] A 503 followed by a 200 resolves with the data and does not throw.
- [ ] Repeated 503 responses stop after 75 s and throw `ApiError` with status 503.
- [ ] A POST that receives 504 is not retried; a GET that receives 504 is.
- [ ] A 400 or 500 is never retried.
- [ ] `apps/web` has no hardcoded user-facing strings and no raw hex colors.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` pass.
- [ ] The M0.5 checkbox in `ROADMAP.md` is ticked in the same PR.

## Decisions

- **Yes:** a second rewrite `/api/health` → `${API_URL}/health`, placed before the generic one. SPEC 01 put `/health` outside the `/api` prefix and pinned `/api/health` as 404, but the ROADMAP "Done when" for M0 requires a page calling `/api/health` through the proxy. A one-line rewrite resolves it without touching the API.
- **No:** moving `/health` under `/api`. It would undo SPEC 01 and break the Render health check path.
- **Yes:** retries live in `api-client`, not in TanStack Query. The waking state must be known in one place, and Query's retry would hide it.
- **Yes:** `QueryClient` defaults `retry: false`. Avoids double retries (client plus Query).
- **Yes:** `healthResponseSchema` in `packages/shared`. CLAUDE.md: schema first, shared as the contract.
- **Yes:** `useSyncExternalStore` for the waking state. No new dependency and it works outside React.
- **No:** Zustand or other state libraries. Extra dependency for one boolean.
- **No:** a mock server (MSW) for tests. Mocking `fetch` with fake timers is enough for this scope.
- **Yes:** quick definition without detailed clarification questions (requested "short"). All choices above were taken from `ARCHITECTURE.md` §2 and `ROADMAP.md`.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| ESM workspace package `@verso/shared` is not transpiled by Next | Add it to `transpilePackages` in `next.config.ts` if the build fails |
| Next rewrite proxy times out before the 75 s budget on a cold start | Retries are per HTTP call, so each attempt is short; a proxy timeout returns 504 and is retried |
| New dependencies without approval | Each one gets its reason in the PR description (CLAUDE.md rule) |

## What is **not** in this spec

- Design tokens, fonts, theming, shadcn or Tailwind.
- i18n and any translated copy.
- The waking banner UI.
- Auth client, sessions or route protection.
- Wake-up ping on landing or sign-in.
- Deploy, CI or security headers.
