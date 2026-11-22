# SPEC 11 — Onboarding (P3), `/v1/me` endpoints and avatar upload (M2.5)

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 07, SPEC 09, SPEC 10
> **Date:** 2026-11-22
> **Objective:** Build the 7-step onboarding flow with the `/v1/me` API (profile, settings, username availability, yearly goal, onboarding completion) and avatar upload through `FileStorage` (Supabase), so a new user can finish onboarding and land on an empty Home.

## Why this spec exists

M2.5 is the last piece before M2 "Done when": register, verify, finish onboarding, reach Home. It is large (shared, API, storage infra, web, i18n). It stays one spec by decision, so the plan is ordered API first, web second, and every step leaves the app runnable.

ROADMAP assigns the yearly-goal endpoints to M5.6, but onboarding step 6 needs to save a goal. This spec adds the `YearlyGoal` table and `PUT /v1/me/goals/{year}` only. M5.6 keeps `GET`, the Settings screen and the Home card.

## Scope

**In:**

- Shared Zod schemas in `packages/shared/src/me.ts`: `meSchema`, `updateMeSchema`, `updateSettingsSchema`, `usernameAvailabilitySchema`, `avatarUploadRequestSchema`, `signedUploadSchema`, `upsertGoalSchema`.
- `UsersModule` in `apps/api/src/modules/users/`: `users.controller.ts`, `users.service.ts`, `users.repository.ts`. Reuses `domain/username-policy.ts`.
- Endpoints (all behind `SessionGuard`, input validated with the shared schemas, errors as problem+json):
  - `GET /v1/me`: current user, settings, onboarding state.
  - `PATCH /v1/me`: `name`, `username`, `bio`, `avatarPath`, `removeAvatar`. `avatarPath` and `removeAvatar` together return 400.
  - `PATCH /v1/me/settings`: `ratingStyle`, `progressStyle`, `profileVisibility`, `defaultAnnotationVisibility`, `locale`, `theme`, `timeZone`. Reminder fields are not accepted (P6).
  - `GET /v1/usernames/{username}/availability`: live check through `UsernamePolicy` plus a uniqueness lookup.
  - `POST /v1/me/avatar/upload-url`: signed upload URL scoped to `avatars/{userId}/…`.
  - `PUT /v1/me/goals/{year}`: upsert the yearly goal.
  - `POST /v1/me/onboarding/complete`: sets `onboardingCompletedAt` when the user has a username.
- `FileStorage` interface, `SupabaseFileStorage` and an in-memory fake in `apps/api/src/infra/storage/`. Env validation for `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`.
- Prisma migration: `YearlyGoal` model.
- Web: `apps/web/src/app/onboarding/[step]/page.tsx` (steps 1 to 7), `apps/web/src/features/onboarding/` components, avatar crop and WebP compression, `lib/api-client.ts` use through TanStack Query.
- Redirect rule: a signed-in user with `onboardingCompletedAt = null` is redirected from the app to `/onboarding/{first incomplete step}`. A completed user who opens `/onboarding/*` is redirected to `/home`. The app side lives in `app/(app)/layout.tsx` through `RequireOnboarded`; the onboarding side in `OnboardingFlow`. Both read `GET /v1/me` (client side: there is no middleware) and show a skeleton, never app content, while the account loads or a redirect is pending. A signed-out visitor goes to `/sign-in`.
- Prefill: name from sign-up or Google; suggested username derived from the name or email and checked for availability.
- Browser time zone and current UI locale are sent with step 1.
- EN and ES copy under the `onboarding` namespace in `packages/i18n/src/messages/{en,es}.json`.
- Tests: unit (shared schemas, goal and avatar-path helpers, step derivation, avatar crop math); integration (every endpoint, including 401, 403 and ownership cases, invalid `targetBooks`, and the `FileStorage` delete on replace and remove); web component tests (redirects in both directions, step 1 availability states and the 409 case, Back and Skip visibility per step, step 2 error states with a mocked failed upload, steps 3 to 7).
- Tick M2.5 in `ROADMAP.md` (done in this PR, plan step 9).

**Out of scope (for future specs):**

- Rate limiting on these routes and sign-up/sign-in integration tests (M2.6).
- `GET /v1/me/goals/{year}`, Settings → Yearly goal and the Home goal card (M5.5, M5.6).
- Step 7 "Import my library": the step shows the explanation and Skip only until M11 (S15).
- Optional 8th step "Turn on reminders" (DESIGN, with P6) and reminder fields in settings.
- `PUT /v1/me/favorites`, `DELETE /v1/me` and the Settings screen.
- Playwright e2e (no e2e setup exists).
- Crop library: the crop is a small canvas component, no new dependency.
- Private bucket and signed read URLs.
- Prefilling the step 6 field when the user comes back to it: it needs `GET /v1/me/goals/{year}` (M5.6).

## Data model

Prisma addition (forward-only migration):

```prisma
model YearlyGoal {
  id          String   @id @default(cuid())
  userId      String
  year        Int
  targetBooks Int
  createdAt   DateTime @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime @updatedAt @db.Timestamptz(3)
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, year])
}
```

`User` gets the back-relation `goals YearlyGoal[]`. No other `User` columns change.

Contracts (`packages/shared/src/me.ts`):

```ts
export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    username: z.string().optional(), // normalized and validated by UsernamePolicy
    bio: z.string().trim().max(300).nullable().optional(),
    avatarPath: z.string().min(1).max(256).optional(), // must be under avatars/{userId}/
    removeAvatar: z.literal(true).optional(),
  })
  .refine((v) => !(v.avatarPath !== undefined && v.removeAvatar)); // not both

export const avatarUploadRequestSchema = z.object({
  contentType: z.literal('image/webp'),
  size: z.number().int().positive().max(2 * 1024 * 1024),
});

export const upsertGoalSchema = z.object({
  targetBooks: z.number().int().min(1).max(999),
});

// apps/api/src/infra/storage/file-storage.ts
interface FileStorage {
  createUploadUrl(path: string, contentType: string): Promise<SignedUpload>;
  delete(path: string): Promise<void>;
  publicUrl(path: string): string;
}
```

Conventions:

- Avatar object path: `avatars/{userId}/{uuid}.webp`. The API builds it; the client never chooses a path.
- After the client uploads, it calls `PATCH /v1/me` with `avatarPath`. The service accepts only a path under `avatars/{userId}/`, stores `User.image = publicUrl(path)`, and deletes the previous object on replace. `removeAvatar: true` sets `image = null` and deletes the object. `avatarPath` is therefore also part of `updateMeSchema` (string, optional).
- No extra `User` column holds the object path. The service finds the previous object by removing the `publicUrl("")` prefix from `User.image`, and deletes it only when the result is a path owned by the user. An image that is not ours (a Google avatar) is never deleted. A failed delete is logged and never fails the save.
- The bucket is public. Objects are image-only, max 2 MB, WebP.
- Username rules stay in `UsernamePolicy`. `PATCH /v1/me` with a taken username returns 409 `USERNAME_TAKEN`. An invalid one returns 400 `USERNAME_INVALID` and the policy reason (`TOO_SHORT`, `TOO_LONG`, `INVALID_CHARACTERS` or `RESERVED`, the `UsernameInvalidReason` values from SPEC 07) goes in `detail`.
- Availability response: `{ available: boolean, reason?: 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED' | 'TAKEN' }`. The first four are the `UsernameInvalidReason` values from SPEC 07, unchanged; `TAKEN` is added by the uniqueness lookup. The user's own current username reports available. The path param is only bounded (1 to 255 characters) by a shared schema: the policy decides validity.
- `timeZone` is validated against `Intl.supportedValuesOf('timeZone')`, plus `UTC` explicitly (the SPEC 07 default, which engines leave out of that list); an invalid value returns 400 `VALIDATION_ERROR`. The browser sends its zone only when it passes the same check.
- `year` in the goal path must be the current year or next year in the user's time zone; otherwise 400 `GOAL_YEAR_INVALID`. Step 6 asks about the **current** year in the user's time zone.
- Error codes: `USERNAME_TAKEN` (409), `USERNAME_INVALID` (400), `USERNAME_REQUIRED` (409), `GOAL_YEAR_INVALID` (400), `STORAGE_UNAVAILABLE` (503, storage not configured or failing). A path outside the user's avatar folder returns 403 `FORBIDDEN`. Other bad input (settings enums, time zone, `targetBooks`, avatar upload request, `avatarPath` with `removeAvatar`) returns 400 `VALIDATION_ERROR`.
- `POST /v1/me/onboarding/complete` returns 409 `USERNAME_REQUIRED` if `username` is null. It is idempotent: a second call keeps the original timestamp.
- Onboarding step is derived, not stored: step 1 incomplete when `username` is null; later steps are optional or have defaults, so a resume lands on step 1 if the username is missing, else on step 2. The client keeps the step in the URL for in-session navigation.
- Settings enums use the exact `User` enum values from SPEC 07.

## Implementation plan

1. Add `packages/shared/src/me.ts` with the schemas and unit tests. Verify: `pnpm --filter shared test`.
2. Add the `YearlyGoal` model and migration. Verify: `pnpm db:migrate` applies on a clean database and `pnpm db:seed` still runs.
3. Add `FileStorage`, the in-memory fake and `SupabaseFileStorage`, with env validation and `.env.example` kept in sync. Verify: unit test for the path builder and the fake; API boots with empty Supabase vars in test and dev (storage only fails when the avatar endpoint is called).
4. Create `UsersModule` with `GET /v1/me`, `PATCH /v1/me`, `PATCH /v1/me/settings`, availability, goal upsert and onboarding complete. Verify: integration tests pass, including 401, ownership and the problem+json codes.
5. Add `POST /v1/me/avatar/upload-url` and the `avatarPath` and `removeAvatar` handling in `PATCH /v1/me`, using the fake in tests. Verify: integration tests for path scoping, wrong user path (403), oversize and wrong content type (400).
6. Add the onboarding shell: route `onboarding/[step]`, progress bar with "Step N of 7", Back, Skip on optional steps, the redirect rule for the app and for `/onboarding`. Steps 1, 3, 4 and 5 call the API. Verify: component tests for the redirects in both directions, the Back and Skip visibility per step, step 1 (prefill, availability states, the 409 case) and steps 3 to 5; manually, a new account is redirected to step 1 and can walk through steps 1, 3, 4, 5.
7. Add step 2 (avatar): file picker, circle crop on a canvas, WebP compression, signed upload, initials fallback, remove. Verify: component tests with a mocked failed upload, a wrong file type and a file still too large after compression show their messages and keep the previous photo; with real Supabase the avatar appears (manual check).
8. Add steps 6 and 7 and the final call to `onboarding/complete`, then redirect to `/home`. Add EN and ES copy for all steps. Verify: finishing the flow lands on the empty Home; reloading `/onboarding/1` redirects to `/home`.
9. Tick M2.5 in `ROADMAP.md`. Verify: `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [ ] `GET /v1/me` returns the user, settings and `onboardingCompletedAt`; without a session it returns 401.
- [ ] `PATCH /v1/me` with a taken username returns 409 `USERNAME_TAKEN`; with a reserved or malformed one returns 400 `USERNAME_INVALID`.
- [ ] `PATCH /v1/me` with a mixed-case valid username stores it lowercased.
- [ ] `PATCH /v1/me/settings` rejects reminder fields and invalid enum values with 400, and stores valid values.
- [ ] `PATCH /v1/me/settings` with an invalid `timeZone` returns 400.
- [ ] `GET /v1/usernames/maria_01/availability` returns `available: false, reason: 'TAKEN'` when another user owns it, and `available: true` for the caller's own username.
- [ ] `POST /v1/me/avatar/upload-url` returns a path under `avatars/{userId}/`; a content type other than `image/webp` or a size over 2 MB returns 400.
- [ ] `PATCH /v1/me` with an `avatarPath` under another user's folder returns 403.
- [ ] Replacing or removing an avatar deletes the previous object through `FileStorage`.
- [ ] `PUT /v1/me/goals/{year}` creates the goal and a second call updates the same row (unique `userId`, `year`); a year outside the allowed range returns 400.
- [ ] `POST /v1/me/onboarding/complete` returns 409 `USERNAME_REQUIRED` without a username, sets `onboardingCompletedAt` otherwise, and a second call keeps the first timestamp.
- [ ] No endpoint in this spec allows reading or writing another user's data (every query filters by the session user id).
- [ ] A signed-in user without `onboardingCompletedAt` who opens `/home` is redirected to onboarding; a completed user who opens `/onboarding/1` is redirected to `/home`.
- [ ] Step 1 prefills the name and a suggested available username, and shows live availability with the reason text.
- [ ] Step 1 saves the browser time zone and the current locale.
- [ ] Step 1 shows an inline message when the server answers 409 `USERNAME_TAKEN`, mapped to an i18n key, and does not move on.
- [ ] Back works on every step after step 1 (step 1 has nothing to go back to, so it shows no Back); Skip appears only on steps 2, 6 and 7.
- [ ] Step 7 shows only Skip, no import action.
- [ ] No hardcoded user-facing strings; EN and ES key parity test passes.
- [ ] No raw hex colors; only tokens.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.

### UI states: Onboarding shell and steps 1, 3, 4, 5, 6, 7

- [ ] **Normal:** renders the step, progress bar, Back (except on step 1) and primary action.
- [ ] **Loading:** skeleton while `GET /v1/me` loads; the primary button shows pending state while saving; no layout jump.
- [ ] **Empty:** N/A for form steps; a missing username on step 1 is the normal empty-field state with the suggestion filled in.
- [ ] **Error:** save failure shows an inline problem message with retry (on step 7 an explicit "Try again"); availability-check failure shows a neutral message and does not block typing; a 409 `USERNAME_TAKEN` shows the taken message on the field.
- [ ] **Light theme:** legible, theme tokens only.
- [ ] **Dark theme:** legible, theme tokens only.
- [ ] **Mobile:** no horizontal scroll, controls reachable by thumb.
- [ ] **Desktop:** centered column, readable width.

### UI states: Step 2 (profile photo)

- [ ] **Normal:** upload, circle crop preview and initials fallback.
- [ ] **Loading:** progress state while compressing and uploading.
- [ ] **Empty:** no photo selected shows the initials avatar and "Skip".
- [ ] **Error:** wrong file type, a file still over 2 MB after compression, or a failed upload shows a message and keeps the previous photo.
- [ ] **Light theme:** legible, theme tokens only.
- [ ] **Dark theme:** legible, theme tokens only.
- [ ] **Mobile:** crop works with touch, no horizontal scroll.
- [ ] **Desktop:** crop works with mouse and keyboard.

Accessibility (all steps): every input has a label, focus moves to the step heading on step change, the progress bar has an accessible name and value, the crop control is keyboard operable, avatar preview has alt text, animations respect reduced motion.

## Decisions

- **Yes:** one spec for the whole of M2.5. Chosen by the author over a split; the plan is ordered so each step stays runnable.
- **Yes:** add `YearlyGoal` and `PUT /v1/me/goals/{year}` here. Step 6 must save somewhere; `GET` and Settings UI stay in M5.6.
- **No:** show step 6 without saving, or drop it. Misleading copy or a "Step N of 6" mismatch with DESIGN.
- **Yes:** save each step to the API and gate the app until `onboardingCompletedAt` is set. Lets a user resume after leaving.
- **No:** hold answers client-side until the end. Losing progress on a reload is worse UX.
- **Yes:** derive the resume step from stored data instead of storing a step column. Avoids a schema change.
- **Yes:** public bucket, path scoped by user id. Avatars are not secret and public reads need no signing.
- **No:** private bucket with signed reads. More moving parts for no gain at ~5 users.
- **Yes:** canvas crop with no new dependency (CLAUDE.md: dependencies need a reason).
- **Yes:** the client compresses to WebP before upload (ARCHITECTURE §10); the API only accepts `image/webp` up to 2 MB.
- **Yes:** time zone from the browser and locale from the UI on step 1. Needed for local session dates; no extra onboarding step.
- **Yes:** the API validates `timeZone`, as SPEC 07 deferred it to this task.
- **No:** reminders step and reminder fields. They belong to P6 (F1.5).
- **Yes:** `POST /v1/me/onboarding/complete` requires a username. Username is the only required step.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Supabase project not created yet | You create it before step 3 (see Human steps). Tests use the fake; only the manual avatar check needs the real bucket. |
| Supabase free project pauses after inactivity | Already covered by the daily tick in M10; out of scope here. |
| Redirect loop between `/home` and `/onboarding` | The rule reads only `onboardingCompletedAt`; covered by a web test for both directions. |
| Orphaned avatar objects if the client uploads and never calls `PATCH` | Accepted for F1; a daily cleanup job in M10 may remove objects no `User.image` points to. |
| Username race between availability check and save | The unique index is the source of truth; the save returns 409 and the form shows it. |
| Canvas WebP encoding unsupported in an old browser | Show the error state with a "Skip" path; avatar is optional. |

## Human steps

- Before step 7's manual check (real upload only; tests use the fake): create a Supabase project and a public bucket named `verso`. Put `SUPABASE_URL` (the project origin, `https://<ref>.supabase.co`; the code ignores any path), `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_BUCKET` in your local `apps/api/.env`. Never commit them.
- During step 7: check a real avatar upload in the browser.
- After step 8: check the flow in light and dark, at mobile width, and review the Spanish copy.

## What is **not** in this spec

- Rate limiting and sign-up/sign-in integration tests (M2.6).
- Yearly-goal `GET`, Settings screen and Home goal card (M5).
- Goodreads import (M11); step 7 only offers Skip.
- Reminders step and reminder settings (P6).
- Favorites and account deletion endpoints.
- Private storage, crop library, Playwright e2e.

Each one, if it lands, goes in its own task or spec.
