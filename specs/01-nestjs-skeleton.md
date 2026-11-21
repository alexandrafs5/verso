# SPEC 01 — Esqueleto NestJS del API (M0.3)

> **Status:** Approved
> **Depends on:** ninguna (M0.1 y M0.2 ya mergeados en `develop`)
> **Date:** 2026-11-21
> **Objective:** Dejar `apps/api` arrancando con Nest, prefijo `/api`, logs pino, helmet, pipe Zod global, filtro problem+json y `GET /health`.

## Scope

**In:**

- Dependencias Nest en `apps/api` (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, `reflect-metadata`, `rxjs`, `helmet`, `nestjs-pino`, `pino-http`, `zod`; dev: `tsx`, `unplugin-swc` + `@swc/core` para Vitest).
- `apps/api/src/main.ts`: bootstrap, prefijo global `/api` con `/health` excluido, helmet, pino, pipe y filtro globales, puerto desde `PORT` (default 4000).
- `apps/api/src/app.module.ts`.
- `apps/api/src/common/`: `ZodValidationPipe` y `ProblemJsonFilter`.
- `apps/api/src/modules/health/`: `HealthController` con `GET /health` → `{ "status": "ok" }`.
- `packages/shared`: `problemSchema` (Zod) y enum `ErrorCode` con los códigos iniciales.
- Scripts `dev` (`tsx watch`), `build` (`tsc`) y `start` en `apps/api/package.json`.
- Tests: unit del pipe y del filtro; integración de `/health` y del shape de error con Supertest.

**Out of scope (para otros specs):**

- Prisma, `PrismaService` y chequeo de DB en `/health` (M0.4).
- Estado de la cola en `/health` (M9.1).
- Better Auth, `SessionGuard`, rate limiting (M2).
- CORS y check de `Origin` contra `WEB_ORIGIN` (se añaden con los primeros endpoints de escritura, M2).
- OpenAPI generado desde Zod.
- Dockerfile y deploy en Render (M12.5).
- CI (M0.6).

## Data model

No hay tablas. Contrato nuevo en `packages/shared/src/problem.ts`, exportado desde `index.ts`:

```ts
export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export const problemSchema = z.object({
  type: z.string(),        // 'about:blank' por defecto
  title: z.string(),
  status: z.number().int(),
  detail: z.string().optional(),
  code: z.nativeEnum(ErrorCode),
  errors: z.array(z.object({ path: z.string(), message: z.string() })).optional(), // solo VALIDATION_ERROR
});
```

Convenciones:

- Respuestas de error con `Content-Type: application/problem+json`.
- Errores 5xx nunca exponen stack ni mensaje interno; solo `INTERNAL_ERROR` genérico. El stack va al log.
- Cada spec posterior añade sus códigos al enum antes de usarlos.

## Implementation plan

1. Añadir dependencias a `apps/api` y scripts `dev`/`build`/`start`. Verificar: `pnpm install` y `pnpm --filter api typecheck` pasan.
2. Crear `problemSchema` y `ErrorCode` en `packages/shared` con test unitario del schema.
3. Crear `AppModule`, `HealthModule`, `HealthController` y `main.ts` mínimo (prefijo `/api`, `/health` excluido). Verificar: `pnpm --filter api dev` y `curl localhost:4000/health` → `{"status":"ok"}`.
4. Verificar inyección de dependencias bajo `tsx`. Si falla por falta de `emitDecoratorMetadata`, cambiar `dev` a loader SWC (ver Riesgos) antes de seguir.
5. Añadir helmet y `nestjs-pino` (JSON en prod, `pino-pretty` solo si ya está instalado en dev; si no, JSON siempre). Verificar: cada request loguea método, ruta, status y duración.
6. Implementar `ProblemJsonFilter` (HttpException, ZodError y errores desconocidos) y registrarlo global. Verificar: ruta inexistente → 404 problem+json con `NOT_FOUND`.
7. Implementar `ZodValidationPipe` (recibe un schema, lanza `VALIDATION_ERROR` con `errors[]`) y registrarlo vía decorador por parámetro. Verificar con un controller de prueba dentro del test.
8. Configurar Vitest con `unplugin-swc` y escribir tests de integración (`/health` fuera de `/api`, `/api/nope` → 404 problem+json, validación → 400, error inesperado → 500 sin fuga de stack).

## Acceptance criteria

- [ ] `pnpm --filter api dev` arranca en el puerto de `PORT` sin errores.
- [ ] `GET /health` responde 200 `{"status":"ok"}`.
- [ ] `GET /api/health` responde 404 (health vive fuera del prefijo).
- [ ] Una ruta inexistente responde 404 con `Content-Type: application/problem+json` y `code: "NOT_FOUND"`.
- [ ] Un body inválido en una ruta con `ZodValidationPipe` responde 400 con `code: "VALIDATION_ERROR"` y `errors[]` con `path` y `message`.
- [ ] Un error no controlado responde 500 con `code: "INTERNAL_ERROR"` y sin stack ni mensaje interno en el body.
- [ ] Toda respuesta incluye cabeceras de helmet (p. ej. `x-content-type-options: nosniff`).
- [ ] Cada request genera una línea de log pino con request id, método, ruta, status y duración.
- [ ] `packages/shared` exporta `problemSchema` y `ErrorCode`; el filtro valida su salida contra `problemSchema` en tests.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pasan.
- [ ] La casilla M0.3 de `ROADMAP.md` queda marcada en el mismo PR.

## Decisions

- **Sí:** `tsx watch` para dev y `tsc` para build. Simple, ESM nativo, sin Nest CLI.
- **No:** Nest CLI. Pelea con ESM puro y obligaría a CommonJS.
- **Sí:** `ZodValidationPipe` propio (~20 líneas). Sin dependencia nueva y usa directo los schemas de `packages/shared`.
- **No:** `nestjs-zod`. Dependencia extra; revisitar solo si se decide generar OpenAPI desde los schemas.
- **Sí:** `/health` solo devuelve `{ status: 'ok' }`. No construir chequeos de infra que aún no existen.
- **Sí:** `problemSchema` y `ErrorCode` en `packages/shared`. Es contrato API↔web y la web los mapea a i18n (regla de CLAUDE.md: schema primero).
- **No:** códigos de error solo en `apps/api`. Habría que moverlos cuando la web los necesite.
- **Sí:** `unplugin-swc` solo para Vitest, porque esbuild no emite metadata de decoradores.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `tsx` (esbuild) no emite `emitDecoratorMetadata`, la DI de Nest por tipo de constructor falla en runtime | Paso 4 lo verifica pronto. Si falla, `dev` usa `node --watch --import @swc-node/register/esm-register` y se anota en el PR |
| Nuevas dependencias sin aprobación | Cada una lleva su razón en la descripción del PR (regla de CLAUDE.md) |
| `/health` fuera del prefijo se rompe por un cambio futuro del prefijo | Test de integración fija ambos comportamientos |

## What is **not** in this spec

- Prisma ni acceso a base de datos.
- Autenticación, guards ni rate limiting.
- CORS, check de `Origin`, OpenAPI.
- Dockerfile, CI ni deploy.
- Cualquier endpoint de negocio.
