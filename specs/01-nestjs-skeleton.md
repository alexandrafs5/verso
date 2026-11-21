# SPEC 01 — NestJS API skeleton (M0.3)

> **Status:** Implemented
> **Depends on:** none (M0.1 and M0.2 are already merged into `develop`)
> **Date:** 2026-11-21
> **Objective:** Get `apps/api` booting with Nest, `/api` prefix, pino logs, helmet, a global Zod pipe, a problem+json filter and `GET /health`.

## Scope

**In:**

- Nest dependencies in `apps/api` (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`, `helmet`, `nestjs-pino`, `pino-http`, `zod`; dev: `tsx`, `unplugin-swc` + `@swc/core` for Vitest).
- `apps/api/src/main.ts`: bootstrap, global `/api` prefix with `/health` excluded, helmet, pino, global pipe and filter, port from `PORT` (default 4000).
- `apps/api/src/app.module.ts`.
- `apps/api/src/common/`: `ZodValidationPipe` and `ProblemJsonFilter`.
- `apps/api/src/modules/health/`: `HealthController` with `GET /health` → `{ "status": "ok" }`.
- `packages/shared`: `problemSchema` (Zod) and `ErrorCode` enum with the initial codes.
- `dev` (`tsx watch`), `build` (`tsc`) and `start` scripts in `apps/api/package.json`.
- Tests: unit tests for the pipe and the filter; integration tests for `/health` and the error shape with Supertest.

**Out of scope (for other specs):**

- Prisma, `PrismaService` and the DB check in `/health` (M0.4).
- Queue status in `/health` (M9.1).
- Better Auth, `SessionGuard`, rate limiting (M2).
- CORS and the `Origin` check against `WEB_ORIGIN` (added with the first write endpoints, M2).
- OpenAPI generated from Zod.
- Dockerfile and Render deploy (M12.5).
- CI (M0.6).

## Data model

No tables. New contract in `packages/shared/src/problem.ts`, exported from `index.ts`:

```ts
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const problemSchema = z.object({
  type: z.string(),        // 'about:blank' by default
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.nativeEnum(ErrorCode),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(), // VALIDATION_ERROR only
});
```

Conventions:

- Error responses use `Content-Type: application/problem+json`.
- 5xx errors never expose the stack or the internal message; only a generic `INTERNAL_ERROR`. The stack goes to the log.
- Each later spec adds its codes to the enum before using them.

## Implementation plan

1. Add dependencies to `apps/api` and the `dev`/`build`/`start` scripts. Verify: `pnpm install` and `pnpm --filter api typecheck` pass.
2. Create `problemSchema` and `ErrorCode` in `packages/shared` with a unit test for the schema.
3. Create `AppModule`, `HealthModule`, `HealthController` and a minimal `main.ts` (`/api` prefix, `/health` excluded). Verify: `pnpm --filter api dev` and `curl localhost:4000/health` → `{"status":"ok"}`.
4. Verify dependency injection under `tsx`. If it fails for lack of `emitDecoratorMetadata`, switch `dev` to the SWC loader (see Risks) before continuing.
5. Add helmet and `nestjs-pino` (JSON in prod, `pino-pretty` only if already installed in dev; otherwise always JSON). Verify: each request logs method, path, status and duration.
6. Implement `ProblemJsonFilter` (HttpException, ZodError and unknown errors) and register it globally. Verify: unknown route → 404 problem+json with `NOT_FOUND`.
7. Implement `ZodValidationPipe` (takes a schema, throws `VALIDATION_ERROR` with `errors[]`) and register it via a per-parameter decorator. Verify with a test controller inside the test.
8. Configure Vitest with `unplugin-swc` and write the integration tests (`/health` outside `/api`, `/api/nope` → 404 problem+json, validation → 400, unexpected error → 500 with no stack leak).

## Acceptance criteria

- [x] `pnpm --filter api dev` starts on the `PORT` port without errors.
- [x] `GET /health` responds 200 `{"status":"ok"}`.
- [x] `GET /api/health` responds 404 (health lives outside the prefix).
- [x] An unknown route responds 404 with `Content-Type: application/problem+json` and `code: "NOT_FOUND"`.
- [x] An invalid body on a route with `ZodValidationPipe` responds 400 with `code: "VALIDATION_ERROR"` and `errors[]` with `path` and `message`.
- [x] An unhandled error responds 500 with `code: "INTERNAL_ERROR"` and no stack or internal message in the body.
- [x] Every response includes helmet headers (e.g. `x-content-type-options: nosniff`).
- [x] Each request produces a pino log line with request id, method, path, status and duration.
- [x] `packages/shared` exports `problemSchema` and `ErrorCode`; the filter validates its output against `problemSchema` in tests.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] The M0.3 checkbox in `ROADMAP.md` is ticked in the same PR.

## Decisions

- **Yes:** `tsx watch` for dev and `tsc` for build. Simple, native ESM, no Nest CLI.
- **No:** Nest CLI. It fights pure ESM and would force CommonJS.
- **Yes:** own `ZodValidationPipe` (~20 lines). No new dependency and it uses the schemas from `packages/shared` directly.
- **No:** `nestjs-zod`. Extra dependency; revisit only if we decide to generate OpenAPI from the schemas.
- **Yes:** `/health` only returns `{ status: 'ok' }`. Don't build infra checks for infra that doesn't exist yet.
- **Yes:** `problemSchema` and `ErrorCode` in `packages/shared`. It is the API↔web contract and the web maps the codes to i18n (CLAUDE.md rule: schema first).
- **No:** error codes only in `apps/api`. They would have to be moved when the web needs them.
- **Yes:** `unplugin-swc` for Vitest only, because esbuild does not emit decorator metadata.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `tsx` (esbuild) does not emit `emitDecoratorMetadata`, so Nest constructor-type DI fails at runtime | Step 4 checks it early. If it fails, `dev` uses `node --watch --import @swc-node/register/esm-register` and it is noted in the PR |
| New dependencies without approval | Each one gets its reason in the PR description (CLAUDE.md rule) |
| `/health` outside the prefix breaks on a future prefix change | An integration test pins both behaviors |

## What is **not** in this spec

- Prisma or any database access.
- Authentication, guards or rate limiting.
- CORS, `Origin` check, OpenAPI.
- Dockerfile, CI or deploy.
- Any business endpoint.
