# SPEC 07 — User extensions and UsernamePolicy (M2.2)

> **Status:** Implemented
> **Depends on:** SPEC 06
> **Date:** 2026-11-22
> **Objective:** Extend the `User` table with username, bio, settings, reminder and onboarding fields, and add a pure, unit-tested `UsernamePolicy` domain class.

## Scope

**In:**

- One forward-only migration adding the extended `User` columns and their enums (ARCHITECTURE §5.3).
- `apps/api/src/modules/users/domain/username-policy.ts`: pure class, no Nest or Prisma imports.
- Unit tests for `UsernamePolicy` in `username-policy.test.ts`.
- Better Auth `user.additionalFields` for the new columns, all `input: false`, so Better Auth reads and returns them but clients cannot set them through `/api/auth/*`: a request that includes them is rejected with 400 `FIELD_NOT_ALLOWED`.
- Extend `AuthUser` in `auth.types.ts` with the new fields.
- Update the seed scaffold only if it creates users (new columns have defaults).
- Tick M2.2 in `ROADMAP.md`.

**Out of scope (for future specs):**

- `GET/PATCH /v1/me`, `/v1/me/settings`, username availability endpoint, avatar upload (M2.5).
- Shared Zod schemas for settings (M2.5, when an endpoint first needs them).
- Applying `UsernamePolicy` in any endpoint or form (M2.5).
- Onboarding screens (M2.5) and reminder behavior (F1.5 P6).
- `UsersModule`, controller, service or repository. Only the `domain/` folder is created.
- Real timezone validation. `timeZone` is stored as a string; M2.5 validates it.

## Data model

Prisma additions to `User` (`bio`, `username`, etc. are columns; names and enum values from ARCHITECTURE §5.3):

```prisma
enum ProfileVisibility { PUBLIC PRIVATE }
enum AnnotationVisibility { PUBLIC PRIVATE }
enum RatingStyle { STARS_WHOLE STARS_HALF STARS_QUARTER DECIMAL_10 HUNDRED }
enum ProgressStyle { PAGES PERCENT }
enum Locale { en es }
enum Theme { SYSTEM LIGHT DARK }

model User {
  // existing fields from SPEC 06 unchanged
  username                    String?              @unique @db.Citext
  bio                         String?
  profileVisibility           ProfileVisibility    @default(PUBLIC)
  defaultAnnotationVisibility AnnotationVisibility @default(PRIVATE)
  ratingStyle                 RatingStyle          @default(STARS_HALF)
  progressStyle               ProgressStyle        @default(PAGES)
  locale                      Locale               @default(en)
  theme                       Theme                @default(SYSTEM)
  timeZone                    String               @default("UTC")
  reminderEnabled             Boolean              @default(false)
  reminderTime                String?              // "HH:mm"
  onboardingCompletedAt       DateTime?
}
```

`UsernamePolicy`:

```ts
class UsernamePolicy {
  static normalize(raw: string): string;          // trim + lowercase
  static validate(raw: string): UsernameResult;   // { ok: true, username } | { ok: false, reason }
}
type UsernameInvalidReason = 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED';
```

Rules (ARCHITECTURE §6): 3 to 20 characters; lowercase letters, digits and underscore; not reserved. `validate` normalizes first, so `Maria_01` is accepted and returned as `maria_01`. Reserved list: `admin`, `api`, `settings`, `u`, `me`, `home`, `search`, `library`, `works`, `authors`, `series`, `stats`, `notifications`, `books`, `import`, `onboarding`, `verso`, `support`, `help`, `null`, `undefined`.

Conventions:

- `username` is nullable: sign-up (M2.1) and Google sign-in create users without one; onboarding (M2.5) sets it.
- Defaults: `profileVisibility` PUBLIC (a public reading profile is the product default); `defaultAnnotationVisibility` PRIVATE (highlights are private until the user opts in); `ratingStyle` STARS_HALF; `locale` en; `timeZone` UTC until onboarding sets it.
- `reminderTime` is a `HH:mm` string, as in ARCHITECTURE §5.3.

## Implementation plan

1. Create `username-policy.ts` with `normalize` and `validate`, plus `username-policy.test.ts`. Verify: `pnpm --filter api test` runs the new unit tests.
2. Add the enums and `User` columns to `schema.prisma`; run `pnpm db:migrate` to create the migration. Verify: it applies on a clean database and `pnpm db:seed` still runs.
3. Register the new columns in `createAuth` as `additionalFields` with `input: false`; extend `AuthUser` in `auth.types.ts` and the guard mapping. Verify: `pnpm --filter api typecheck`.
4. Extend `auth.integration.test.ts`: a new user gets the defaults, and a sign-up body with any of the new fields (`username`, `profileVisibility`, ...) is rejected with 400 `FIELD_NOT_ALLOWED` and creates no user. Verify: `pnpm --filter api test`.
5. Tick M2.2 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [x] `pnpm db:migrate` on an empty database adds all columns above and the six enums; existing SPEC 06 data is untouched.
- [x] A newly signed-up user has `username = null`, `profileVisibility = PUBLIC`, `defaultAnnotationVisibility = PRIVATE`, `ratingStyle = STARS_HALF`, `progressStyle = PAGES`, `locale = en`, `theme = SYSTEM`, `timeZone = "UTC"`, `reminderEnabled = false`, `onboardingCompletedAt = null`.
- [x] Sign-up with `username`, `profileVisibility` or any other new field in the body is rejected with 400 `FIELD_NOT_ALLOWED` and creates no user.
- [x] Two users cannot share a username that differs only by case (database unique violation).
- [x] `UsernamePolicy.validate` accepts `ab_1` style names of 3 and 20 characters and rejects 2 and 21 with `TOO_SHORT` and `TOO_LONG`.
- [x] `UsernamePolicy.validate` rejects spaces, hyphens, dots, accents and emoji with `INVALID_CHARACTERS`.
- [x] `UsernamePolicy.validate` rejects every reserved word with `RESERVED`, including `ADMIN` (case-insensitive).
- [x] `UsernamePolicy.validate("  Maria_01 ")` returns `{ ok: true, username: "maria_01" }`.
- [x] `username-policy.ts` imports nothing from `@nestjs/*` or Prisma.
- [x] Unit tests cover every `UsernameInvalidReason` and the boundary lengths 3 and 20.
- [x] `AuthUser` exposes the new fields and the SPEC 06 guard tests still pass.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] The M2.2 checkbox in `ROADMAP.md` is ticked in the same PR.

UI states: N/A, this spec touches no screen or component.

## Decisions

- **Yes:** `username` nullable. Sign-up and Google create users without a username; onboarding sets it.
- **No:** require `username` at sign-up. Needs custom sign-up fields and breaks Google sign-in, which has none.
- **Yes:** `@db.Citext` for `username`, as ARCHITECTURE §5.3 says. Case-insensitive uniqueness is enforced by the database.
- **No:** plain text column with a lowercase-only rule. It would work because the policy lowercases, but it differs from ARCHITECTURE.
- **Yes:** all new fields are `input: false` in Better Auth. Settings change through `/v1/me` in M2.5 with Zod validation, not through the auth handler.
- **Yes:** `UsernamePolicy` as static methods on a pure class. It holds no state.
- **Yes:** `validate` normalizes before checking. The UI can show what will be saved and uppercase typing is not an error.
- **No:** a `UsersModule` now. No endpoint uses it until M2.5; an empty module is dead code.
- **No:** shared Zod schemas for settings now. M2.5 introduces the first endpoint that needs them (CLAUDE.md: schema first, then both apps, at that time).
- **Yes:** `timeZone` defaults to `UTC` and `locale` to `en`. Onboarding sets the real values.
- **Yes:** quick definition without detailed clarification, requested by the user ("corto"). The defaults, the reserved-word list and the `citext` choice are mine and unconfirmed.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Prisma 7 may not support `@db.Citext` without extra setup | Add `CREATE EXTENSION IF NOT EXISTS citext` by hand at the top of the migration. If Prisma still rejects the type, stop and ask, because the fallback differs from ARCHITECTURE |
| Better Auth rejects non-string additional field types (enums, dates) | Declare enum fields as `string` and the date as `date`; the database enforces enum values |
| Reserved list misses a future route | List lives in one constant; later specs extend it |

## What is **not** in this spec

- `/v1/me` endpoints, username availability or avatar upload.
- Shared Zod schemas for settings.
- Any use of `UsernamePolicy` outside its own tests.
- Onboarding, reminders or any web screen.
- A `UsersModule`, controller, service or repository.
