# SPEC 09 — Auth layout, sign-in and sign-up screens (M2.4, part 1)

> **Status:** Approved
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
- Wake-up ping on the sign-in page: fire-and-forget `GET /api/health` on mount (ARCHITECTURE §3).
- Signed-in users opening `/sign-in` or `/sign-up` are redirected to `/home`.
- Placeholder `apps/web/src/app/(app)/home/page.tsx` inside `AppShell` with an empty state, and a client session check that redirects to `/sign-in` when there is no session.
- EN and ES copy in `packages/i18n/src/messages/{en,es}.json` under an `auth` namespace. No hardcoded user-facing strings.
- Dependencies: `better-auth` (client, same version as `apps/api`), `react-hook-form`, `@hookform/resolvers`. One-line PR reason: the architecture mandates them and none exists in `apps/web`.
- Vitest tests for schemas, quote picker, strength function, error mapping and the two forms.

**Out of scope (for future specs):**

- Verify-email, forgot-password and reset-password screens (SPEC 10).
- Onboarding, `/v1/me`, username and avatar (M2.5).
- Rate limiting on the server (M2.6). The UI only handles a 429 response.
- Real Home content (M3 and later), real session-based route protection (middleware or server guard).
- A public config flag to hide the Google button when Google is not configured.
- Quote translations. Quotes stay in their original language.
- Playwright e2e (no e2e setup exists yet).

## Data model

No database or API changes. New code-level contracts:

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
- Server renders `AUTH_QUOTES[0]`; the client picks a random one in `useEffect` after mount to avoid a hydration mismatch.
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
8. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [ ] `/sign-in` and `/sign-up` render the split layout with a quote and author in serif italic on the left panel.
- [ ] The quote changes between visits (random on mount) and does not cause a hydration warning in the console.
- [ ] Submitting `/sign-up` with valid data calls `signUp.email` and shows "Check your inbox" with the entered email; a verification email appears in Mailpit.
- [ ] Password below 8 characters shows a field error before any request is sent.
- [ ] The strength hint shows `weak`, `fair` or `strong` for the passwords covered in its unit test and never disables the submit button.
- [ ] The show/hide control toggles the password input type and has an accessible name.
- [ ] Signing up with an existing email shows the same "Check your inbox" panel as a new email (Better Auth anti-enumeration response, no account is created and no error is shown).
- [ ] If the API ever answers a sign-up with `USER_ALREADY_EXISTS*` (422), the form shows the "email already in use" message with a link to Sign in (unit test with a mocked client).
- [ ] Signing in with wrong credentials shows one generic message that does not say which field was wrong.
- [ ] Signing in with an unverified account shows the inline notice with the email, and a new verification email appears in Mailpit.
- [ ] Signing in with a verified account redirects to `/home`.
- [ ] A 429 response shows the "too many attempts, try again in a minute" message.
- [ ] A network failure shows the generic error and keeps the typed values.
- [ ] "Continue with Google" calls `signIn.social` with provider `google`; `/sign-in?error=oauth` shows the Google failure message.
- [ ] "Forgot password?" links to `/forgot-password`.
- [ ] A signed-in user visiting `/sign-in` or `/sign-up` is redirected to `/home`.
- [ ] A signed-out visit to `/home` redirects to `/sign-in`.
- [ ] Sign-in page mount sends one `GET /api/health` and does not block rendering.
- [ ] Every label, placeholder, error and button text comes from `packages/i18n` and exists in EN and ES.
- [ ] No raw hex colors, no emojis, no new icon without a text label (except show/hide, which has an `aria-label`).
- [ ] Both forms are fully usable with the keyboard; inputs have labels; errors are announced (`aria-live` or `aria-describedby`).
- [ ] Reduced motion is respected for any transition.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] M2.4 stays unticked in `ROADMAP.md` (SPEC 10 ticks it).

### UI states: Auth layout (quote panel)

- [ ] **Normal:** quote and author shown; changes on each visit.
- [ ] **Loading:** N/A, quotes are static; first quote renders on the server.
- [ ] **Empty:** N/A, the quote list is a fixed constant.
- [ ] **Error:** N/A, no data fetching.
- [ ] **Light theme:** the left panel stays dark (wine or charcoal) and legible; the right surface uses tokens.
- [ ] **Dark theme:** all text meets WCAG AA contrast.
- [ ] **Mobile:** the quote collapses to a short band at the top, no horizontal scroll.
- [ ] **Desktop:** two halves side by side.

### UI states: Sign in

- [ ] **Normal:** email, password, forgot link, submit, Google, link to Create account.
- [ ] **Loading:** the submit button shows a pending state and fields are disabled while the request runs; a slow API shows the existing waking banner behavior without layout jump.
- [ ] **Empty:** N/A, a form has no empty state; empty fields show validation errors on submit.
- [ ] **Error:** wrong credentials, unverified, rate limited, network and Google failure each show their message and allow retry.
- [ ] **Light theme:** legible and token-based.
- [ ] **Dark theme:** legible and token-based.
- [ ] **Mobile:** no horizontal scroll, touch targets at least 44px.
- [ ] **Desktop:** works at desktop width.

### UI states: Create account

- [ ] **Normal:** name, email, password with strength hint, submit, Google, link to Sign in.
- [ ] **Loading:** pending submit as in Sign in.
- [ ] **Empty:** the "Check your inbox" panel after success, with the email and a link back to Sign in. Empty fields show validation errors on submit.
- [ ] **Error:** email in use (fallback only), rate limited, network and Google failure.
- [ ] **Light theme:** legible and token-based.
- [ ] **Dark theme:** legible and token-based.
- [ ] **Mobile:** no horizontal scroll.
- [ ] **Desktop:** works at desktop width.

### UI states: Placeholder Home

- [ ] **Normal:** `AppShell` with an empty state ("Your library will appear here") and a next action link placeholder-free (no dead links).
- [ ] **Loading:** skeleton while the session check runs.
- [ ] **Empty:** this is the empty state.
- [ ] **Error:** if the session check fails by network, show `ErrorState` with retry.
- [ ] **Light theme:** token-based.
- [ ] **Dark theme:** token-based.
- [ ] **Mobile:** bottom tab bar from `AppShell` works.
- [ ] **Desktop:** top bar from `AppShell` works.

## Decisions

- **Yes:** two specs for M2.4 (this one and SPEC 10), chosen by the user to keep PRs small.
- **Yes:** land on a placeholder `/home` after sign-in. M2.5 later redirects to onboarding. Chosen by the user.
- **Yes:** always render the Google button and show a generic error if Google is not configured. Chosen by the user. Hiding it needs a new endpoint or env var.
- **No:** public config flag for Google. Extra scope for a ~5-user project.
- **Yes:** 12 static EN quotes, random on mount, first quote fixed on the server. Chosen by the user. Per-day rotation was rejected because DESIGN says "changes on each visit".
- **Yes:** password min 8 with a non-blocking 3-level hint. Chosen by the user. Stricter composition rules need an API change and add little for this audience.
- **Yes:** redirect signed-in users away from the auth pages, client-side with `useSession`. Chosen by the user.
- **Yes:** unverified sign-in shows an inline notice. Chosen by the user. SPEC 10 may turn it into a redirect to `/verify-email`.
- **Yes (mine, unconfirmed):** sign-up success shows an inline "Check your inbox" panel in this spec, because no verify screen exists yet. SPEC 10 replaces it with a redirect.
- **Yes:** keep Better Auth's anti-enumeration response for duplicate sign-ups. Chosen by the user during implementation. With `requireEmailVerification: true` the API answers a duplicate with a fake success, so the UI cannot say "email in use". The "email in use" message stays in the form only as a fallback for a 422.
- **No:** turn the generic duplicate response off in `auth.ts`. It would reveal which emails are registered and needs an API change outside this spec.
- **Yes (mine, unconfirmed):** sign-up asks for `name` because Better Auth requires it. M2.5 step 1 lets the user edit the display name.
- **Yes (mine, unconfirmed):** verification link `callbackURL` is `/sign-in`. No auto sign-in after verification.
- **No:** server-side route protection (middleware). Everything behind sign-in is client-rendered (ARCHITECTURE §3); real guards come with the app shell work in later tasks.
- **No:** translating quotes. They are source text from public-domain authors.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Better Auth client version differs from the API version | Pin the same version in both `package.json` files |
| Error `code` strings differ between Better Auth versions | `map-auth-error.ts` is unit tested against recorded error shapes and falls back to the generic message |
| Cold start makes the first sign-in take up to a minute | Wake-up ping on mount plus the existing waking banner (SPEC 05) |
| Google round trip cannot be tested without credentials | Unit test the call arguments; the user verifies the real round trip manually after setting `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` |
| Quote random pick causes hydration mismatch | Server renders a fixed first quote; pick runs in `useEffect` |

## What is **not** in this spec

- Verify-email, forgot-password and reset-password screens (SPEC 10).
- Onboarding, `/v1/me`, username, avatar (M2.5).
- Server-side rate limiting (M2.6).
- A Google-enabled config flag.
- Translated quotes.
- Real Home content and server-side route guards.
- Playwright e2e.
