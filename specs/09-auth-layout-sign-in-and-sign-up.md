# SPEC 09 — Auth layout, sign-in and sign-up screens (M2.4, part 1)

> **Status:** Implemented
> **Depends on:** SPEC 03, SPEC 05, SPEC 06, SPEC 08
> **Date:** 2026-11-22
> **Objective:** Build the split-screen auth layout with a rotating public-domain quote, the sign-in and create-account screens (email + password and Google), and a placeholder `/home`, all wired to Better Auth.

## Why this spec exists

M2.4 covers five screens (DESIGN P2). Spec 09 ships layout, sign-in and sign-up; SPEC 10 ships verify-email, forgot-password and reset-password. M2.4 is ticked in `ROADMAP.md` only by SPEC 10. This spec also adds the first web dependencies for forms and the Better Auth client.

## Scope

**In:**

- `apps/web/src/app/(auth)/layout.tsx`: split layout. Left half is a dark panel with the quote in large serif italic and the author name. Right half is the form on the surface color. On mobile the quote collapses to a short band at the top.
- `apps/web/src/app/(auth)/sign-in/page.tsx` and `(auth)/sign-up/page.tsx`.
- `apps/web/src/features/auth/`: `SignInForm.tsx`, `SignUpForm.tsx`, `PasswordField.tsx` (show/hide), `PasswordStrength.tsx`, `GoogleButton.tsx`, `AuthQuote.tsx`, `quotes.ts`, `use-redirect-if-signed-in.ts`, `map-auth-error.ts`.
- `apps/web/src/lib/auth-client.ts`: Better Auth client (`createAuthClient`, same-origin `/api/auth` through the existing rewrite).
- Zod schemas in `packages/shared/src/auth.ts` (exported from `index.ts`): `signInSchema`, `signUpSchema`.
- Forms use `react-hook-form` with the shared Zod schemas.
- Create account: name, email, password (show/hide, 3-level strength hint), "Create account", divider "or", "Continue with Google", link to Sign in.
- Sign in: email, password (show/hide), "Forgot password?" link (points to `/forgot-password`, built in SPEC 10), "Sign in", Google button, link to Create account.
- Sign-up success: the same page swaps the form for an inline "Check your inbox" notice showing the email.
- Sign-in `403` (email not verified): inline notice with the email and "We sent you a new link". The API already re-sends the email (SPEC 08).
- Error mapping for: wrong credentials, email already in use, rate limited (429), network or server error, Google failure.
- Wake-up ping on the sign-in page: fire-and-forget `GET /api/health` on mount (ARCHITECTURE §3). It goes through the web rewrite (`/api/health` maps to the API's `/health`), not directly to `{API_URL}/health`, so the browser stays same-origin. It is a raw `fetch` on purpose: its result is ignored, so it bypasses `api-client`.
- Waking banner: the `(auth)` layout mounts the existing `WakingBanner` as an overlay at the top of the form column, and `withWaking()` marks the waking state when a Better Auth request takes longer than 3 s, because the Better Auth client does not go through `api-client`.
- Auth requests use the Better Auth client directly (`signIn`, `signUp`, `useSession`), not TanStack Query or `api-client`. That is the one exception to the data-fetching rule here.
- Signed-in users opening `/sign-in` or `/sign-up` are redirected to `/home`.
- Placeholder `apps/web/src/app/(app)/home/page.tsx`, rendering `features/home/HomePlaceholder.tsx`. The component reads the session with `useSession()` and feeds the user (name, username or empty, image, role) to `AppShell`. While the session loads it shows a skeleton, with no redirect. With no session it redirects to `/sign-in`. If the session check fails it shows `ErrorState` with retry. Its Sign out menu item calls `authClient.signOut()` and goes to `/sign-in`. It exists only as the sign-in landing, until the real Home and server-side guards exist.
- `apps/web/src/lib/auth-client.ts` also declares the `username` and `role` additional fields (`inferAdditionalFields`), so the web reads them typed without importing the API's types.
- DESIGN P2 is updated in this spec: Create account lists name, email and password (name is required by Better Auth and editable in M2.5).
- EN and ES copy in `packages/i18n/src/messages/{en,es}.json` under an `auth` namespace. No hardcoded user-facing strings.
- Dependencies: `better-auth` (client, same version as `apps/api`), `react-hook-form`, `@hookform/resolvers`. One-line PR reason: the architecture mandates them and none exists in `apps/web`.
- Vitest tests for schemas, quote picker, strength function, error mapping and the two forms.
- API, added after manual testing: an "account already exists" email, sent through Better Auth's `onExistingUserSignUp` hook when someone signs up with an email that is already registered. Files: `apps/api/src/infra/email/templates/account-exists.ts` (EN and ES, same layout as SPEC 08), `AuthEmailService.sendAccountExists`, the hook in `apps/api/src/modules/auth/auth.ts`, and tests. The HTTP response stays identical to a new sign-up.

**Out of scope (for future specs):**

- Verify-email, forgot-password and reset-password screens (SPEC 10).
- Onboarding, `/v1/me`, username and avatar (M2.5).
- Rate limiting on the server (M2.6). The UI only handles a 429 response.
- Real Home content (M3 and later), real session-based route protection (middleware or server guard).
- Rate limiting of the sign-up route against mail bombing through duplicate sign-ups (M2.6).
- A public config flag to hide the Google button when Google is not configured.
- Quote translations. Quotes stay in their original language.
- Playwright e2e (no e2e setup exists yet).

## Data model

No database changes. The only API change is the account-exists email (Scope, last "In" bullet): a template, `AuthEmailService.sendAccountExists` and the `onExistingUserSignUp` hook, with no new endpoint. New code-level contracts:

```ts
// packages/shared/src/auth.ts
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
});

export const signUpSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(8).max(128),
});

// apps/web/src/features/auth/quotes.ts
type AuthQuote = { text: string; author: string };
export const AUTH_QUOTES: readonly AuthQuote[]; // 12 public-domain quotes
```

Conventions:

- Password minimum 8 matches `minPasswordLength` in `auth.ts`. The strength meter (`weak | fair | strong`, from length and character variety) is a hint and never blocks submit.
- Quote text is exempt from i18n because it is public-domain source text. The author name is not translated.
- The `(auth)/layout.tsx` server component picks the quote per request with `pickQuote()` and passes it to `AuthQuote` as a prop. Server and client render the same quote, so there is no hydration mismatch and no visible swap after load.
- Sign-up calls `signUp.email({ name, email, password, callbackURL: '/sign-in' })`. Sign-in calls `signIn.email({ email, password, callbackURL: '/home' })`. Google calls `signIn.social({ provider: 'google', callbackURL: '/home', errorCallbackURL: '/sign-in?error=oauth' })`.
- The `/sign-in?error=oauth` query shows the Google failure message.
- Error mapping uses the Better Auth error `status` and `code`: 401 or `INVALID_EMAIL_OR_PASSWORD` is wrong credentials, 403 is not verified, `USER_ALREADY_EXISTS` is email in use, 429 is rate limited, anything else is generic. Messages never reveal which of email or password was wrong.

## Implementation plan

1. Add dependencies, `lib/auth-client.ts` and `packages/shared/src/auth.ts` with schema unit tests. Verify: `pnpm typecheck && pnpm --filter shared test`.
2. Add the `auth` i18n namespace in EN and ES for every state and error below. Verify: the existing i18n key-parity test passes.
3. Create `quotes.ts`, `AuthQuote.tsx` and the `(auth)/layout.tsx` split layout with a stub sign-in page. Unit test the quote picker. Verify: `/sign-in` renders the split layout in light and dark, at phone and desktop widths.
4. Create `PasswordField`, `PasswordStrength` and `map-auth-error.ts` with unit tests. Verify: `pnpm --filter web test`.
5. Build `SignInForm` and the sign-in page: validation, submit, error and unverified states, Google button, wake-up ping, redirect when signed in. Verify: sign in against local API with a verified user and land on the placeholder `/home`.
6. Create the placeholder `(app)/home/page.tsx` with a session check. Verify: signed-out visit to `/home` redirects to `/sign-in`.
7. Build `SignUpForm`, the sign-up page and the inline "Check your inbox" state. Verify: sign up, read the email in Mailpit (`http://localhost:8025`), open the link, then sign in.
8. Add the account-exists email: template in EN and ES with a unit test (same checks as SPEC 08 templates), `AuthEmailService.sendAccountExists`, and the `onExistingUserSignUp` hook (not awaited, like the other hooks). Integration test with the in-memory provider. Verify: sign up twice with the same email and read the "account exists" email in Mailpit.
9. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [x] `/sign-in` and `/sign-up` render the split layout with a quote and author in serif italic on the left panel.
- [x] `pickQuote` returns the quote at the index given by an injected random function (unit test), and the `(auth)` layout calls it once per request, so the first paint already shows the final quote with no swap and no hydration warning in the console (checked manually).
- [x] `AUTH_QUOTES` has at least 12 entries with non-empty text and author, and no duplicate text (unit test).
- [x] Submitting `/sign-up` with valid data calls `signUp.email` and shows "Check your inbox" with the entered email; a verification email appears in Mailpit.
- [x] Password below 8 characters shows a field error before any request is sent.
- [x] The strength hint shows `weak`, `fair` or `strong` for the passwords covered in its unit test and never disables the submit button.
- [x] The show/hide control toggles the password input type and has an accessible name.
- [x] Signing up with an existing email shows the same "Check your inbox" panel as a new email (Better Auth anti-enumeration response, no account is created and no error is shown).
- [x] Signing up with an existing email sends exactly one "account already exists" email to that address, in Spanish when `Accept-Language` is `es` (otherwise the user's `locale`, then English). The email links to the sign-in page, not to any token.
- [x] The HTTP status and body of a duplicate sign-up match those of a new sign-up (no account enumeration), and no second user is created.
- [x] The account-exists email HTML escapes the user's name, contains no images, and does not appear in `info`-level logs with its URL; a send failure is logged without the address (same rules as SPEC 08).
- [x] If the API ever answers a sign-up with `USER_ALREADY_EXISTS*` (422), the form shows the "email already in use" message with a link to Sign in (unit test with a mocked client).
- [x] Signing in with wrong credentials shows one generic message that does not say which field was wrong.
- [x] Signing in with an unverified account shows the inline notice with the email, and a new verification email appears in Mailpit.
- [x] Signing in with a verified account redirects to `/home`.
- [x] A 429 response shows the "too many attempts, try again in a minute" message.
- [x] A network failure shows the network error message ("We could not reach the server...") and keeps the typed values.
- [x] "Continue with Google" calls `signIn.social` with provider `google`; `/sign-in?error=oauth` shows the Google failure message.
- [x] "Forgot password?" links to `/forgot-password`.
- [x] A signed-in user visiting `/sign-in` or `/sign-up` is redirected to `/home`.
- [x] A signed-out visit to `/home` redirects to `/sign-in` (component test), and a pending session shows the skeleton without redirecting.
- [x] Sign-in page mount sends one `GET /api/health` (component test with a mocked `fetch`) and does not block rendering.
- [x] A Better Auth request that takes longer than 3 s marks the waking state, and the banner shows over the top of the form column without moving the form (`withWaking` unit test; layout checked manually).
- [x] Every label, placeholder, error and button text comes from `packages/i18n` and exists in EN and ES.
- [x] No raw hex colors and no hardcoded radii or sizes outside tokens and the Tailwind scale; no emojis; no icon-only controls (the show/hide control is a text button "Show" or "Hide" with a full `aria-label`).
- [x] On mobile the Show/Hide button is 44px tall, and the "Forgot password?" link has a hit area of at least 44px without changing the layout.
- [x] Tab order follows reading order: sign-in is email, password, Show, Forgot password, submit, Google, Create account; sign-up is name, email, password, Show, submit, Google, Sign in (covered by a test).
- [x] Both forms submit with Enter; inputs have labels (component tests query them by label); field errors are linked with `aria-describedby` and `aria-invalid`, and form errors use `role="alert"` or `role="status"`.
- [x] Reduced motion is respected for any transition.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] M2.4 stays unticked in `ROADMAP.md` (SPEC 10 ticks it).

### UI states: Auth layout (quote panel)

- [x] **Normal:** quote and author shown; changes on each visit.
- [x] **Loading:** N/A, quotes are static; first quote renders on the server.
- [x] **Empty:** N/A, the quote list is a fixed constant.
- [x] **Error:** N/A, no data fetching.
- [x] **Light theme:** the left panel stays dark (wine or charcoal) and legible; the right surface uses tokens.
- [x] **Dark theme:** all text meets WCAG AA contrast.
- [x] **Mobile:** the quote collapses to a short band at the top, no horizontal scroll.
- [x] **Desktop:** two halves side by side.

### UI states: Sign in

- [x] **Normal:** email, password, forgot link, submit, Google, link to Create account.
- [x] **Loading:** the submit button shows a pending state and fields are disabled while the request runs; a slow API shows the existing waking banner behavior without layout jump.
- [x] **Empty:** N/A, a form has no empty state; empty fields show validation errors on submit.
- [x] **Error:** wrong credentials, unverified, rate limited, network and Google failure each show their message and allow retry.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** no horizontal scroll, touch targets at least 44px.
- [x] **Desktop:** works at desktop width.

### UI states: Create account

- [x] **Normal:** name, email, password with strength hint, submit, Google, link to Sign in.
- [x] **Loading:** pending submit as in Sign in.
- [x] **Empty:** the "Check your inbox" panel after success, with the email and a link back to Sign in. Empty fields show validation errors on submit.
- [x] **Error:** email in use (fallback only), rate limited, network and Google failure.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** no horizontal scroll.
- [x] **Desktop:** works at desktop width.

### UI states: Placeholder Home

- [x] **Normal:** `AppShell` with an empty state ("Your library will appear here") and no action link (nothing to link to yet, so no dead links).
- [x] **Loading:** skeleton while the session check runs.
- [x] **Empty:** this is the empty state.
- [x] **Error:** if the session check fails by network, show `ErrorState` with retry.
- [x] **Light theme:** token-based.
- [x] **Dark theme:** token-based.
- [x] **Mobile:** bottom tab bar from `AppShell` works.
- [x] **Desktop:** top bar from `AppShell` works.

## Decisions

- **Yes:** two specs for M2.4 (this one and SPEC 10), chosen by the user to keep PRs small.
- **Yes:** land on a placeholder `/home` after sign-in. M2.5 later redirects to onboarding. Chosen by the user.
- **Yes:** always render the Google button and show a generic error if Google is not configured. Chosen by the user. Hiding it needs a new endpoint or env var.
- **No:** public config flag for Google. Extra scope for a ~5-user project.
- **Yes:** 12 static EN quotes, random per request on the server. Chosen by the user, then changed after manual testing: the first design (fixed first quote on the server, random pick after mount) showed one quote and swapped it a moment later. Per-day rotation was rejected because DESIGN says "changes on each visit".
- **No:** client-side random pick after mount. It causes the visible swap described above.
- **Yes:** the `Forgot password?` link comes after the password input in DOM order (a CSS grid keeps it on the label row), so Tab goes email, password, Show, Forgot, submit. Found in manual testing.
- **Yes:** password min 8 with a non-blocking 3-level hint. Chosen by the user. Stricter composition rules need an API change and add little for this audience.
- **Yes:** redirect signed-in users away from the auth pages, client-side with `useSession`. Chosen by the user.
- **Yes:** unverified sign-in shows an inline notice. Chosen by the user. SPEC 10 may turn it into a redirect to `/verify-email`.
- **Yes (confirmed by the user at task close):** sign-up success shows an inline "Check your inbox" panel in this spec, because no verify screen exists yet. SPEC 10 replaces it with a redirect.
- **Yes:** keep Better Auth's anti-enumeration response for duplicate sign-ups. Chosen by the user during implementation. With `requireEmailVerification: true` the API answers a duplicate with a fake success, so the UI cannot say "email in use". The "email in use" message stays in the form only as a fallback for a 422.
- **Yes:** send an "account already exists" email on a duplicate sign-up. Chosen by the user after manual testing: with the generic response, a real person who forgot their account would wait for an email that never arrives. The email says an account exists and links to sign-in; the sign-in page has "Forgot password?" (reset screens ship in SPEC 10, so the email does not link to them).
- **No:** leave duplicate sign-ups silent. Confusing for a legitimate user.
- **No:** turn the generic duplicate response off in `auth.ts`. It would reveal which emails are registered and needs an API change outside this spec.
- **Yes (confirmed by the user at task close):** sign-up asks for `name` because Better Auth requires it. M2.5 step 1 lets the user edit the display name. DESIGN P2 is updated to list it.
- **Yes (confirmed by the user at task close):** the sign-up verification link `callbackURL` is `/sign-in`, with no auto sign-in after verification. SPEC 10 changes it, and also the sign-in `callbackURL`, to `/verify-email?status=success`. Until SPEC 10 ships, a verification link re-sent by an unverified sign-in lands on `/home` (`callbackURL` `/home`) and bounces to `/sign-in`. This is a known gap.
- **Yes:** the quote strength bars use `--radius-chip` and `h-0.75`, and the touch-target fixes for Show/Hide and Forgot password come from the task-close review.
- **Yes:** DESIGN's "what happened, what to do, Retry" is met on forms by the message plus resubmitting the form; there is no separate Retry button on form errors. `ErrorState` with retry is used only on the placeholder Home.
- **No:** server-side route protection (middleware). Everything behind sign-in is client-rendered (ARCHITECTURE §3); real guards come with the app shell work in later tasks.
- **No:** translating quotes. They are source text from public-domain authors.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Better Auth client version differs from the API version | Pin the same version in both `package.json` files |
| Error `code` strings differ between Better Auth versions | `map-auth-error.ts` is unit tested against recorded error shapes and falls back to the generic message |
| Cold start makes the first sign-in take up to a minute | Wake-up ping on mount plus the existing waking banner (SPEC 05), mounted in the `(auth)` layout |
| Steps 5 to 8 need Docker | `docker compose up -d` must be running (Postgres for the integration tests, Mailpit at `http://localhost:8025` for the email checks) |
| Google round trip cannot be tested without credentials | Unit test the call arguments; the user verifies the real round trip manually after setting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| Duplicate sign-ups can be used to email-bomb a registered address | Accepted until M2.6 adds rate limiting on auth routes (10 per minute per IP) |
| Quote random pick causes hydration mismatch or a visible swap | The pick happens once on the server and is passed as a prop; the root layout already makes every route dynamic |

## What is **not** in this spec

- Verify-email, forgot-password and reset-password screens (SPEC 10).
- Onboarding, `/v1/me`, username, avatar (M2.5).
- Server-side rate limiting (M2.6).
- A Google-enabled config flag.
- Translated quotes.
- Real Home content and server-side route guards.
- Playwright e2e.
