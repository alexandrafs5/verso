# SPEC 10 — Verify-email, forgot-password and reset-password screens (M2.4, part 2)

> **Status:** Implemented
> **Depends on:** SPEC 08, SPEC 09
> **Date:** 2026-11-22
> **Objective:** Build the verify-email, forgot-password and reset-password screens, replace the inline notices from SPEC 09 with a redirect to verify-email, and close M2.4.

## Why this spec exists

SPEC 09 shipped sign-in and sign-up with temporary inline notices because the verify screen did not exist. This spec adds the remaining P2 screens (DESIGN P2) and removes that temporary UI, so M2.4 is ticked here.

## Scope

**In:**

- `apps/web/src/app/(auth)/verify-email/page.tsx`, `(auth)/forgot-password/page.tsx`, `(auth)/reset-password/page.tsx`, using the SPEC 09 layout.
- `apps/web/src/features/auth/`: `VerifyEmailPanel.tsx`, `ResendButton.tsx`, `use-resend-cooldown.ts`, `pending-email.ts` (sessionStorage helper), `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`.
- Zod schemas in `packages/shared/src/auth.ts`: `emailOnlySchema`, `resetPasswordSchema`.
- Verify-email screen with three states: pending ("Check your inbox", the email shown, "Resend email" with cooldown), success (email verified, "Sign in" button), and expired or invalid link (message plus Resend).
- Forgot password: email field, then the neutral message "If an account exists, we sent a link". The same message shows whether or not the account exists.
- Reset password: new password (show/hide and the SPEC 09 strength hint) plus confirm. Reads `token` from the query string. On success redirects to `/sign-in?reset=success`. An invalid or expired token shows an expired-link state with a link to `/forgot-password`.
- Sign-in shows a success notice when `?reset=success` is present.
- Change SPEC 09 forms: after sign-up success and after a sign-in `403`, save the email with `pending-email.ts` and redirect to `/verify-email`. Remove the two inline notices.
- Change the sign-up `callbackURL` from `/sign-in` to `/verify-email?status=success`. Resend uses the same `callbackURL`.
- Change the sign-in `callbackURL` as well: SPEC 09 sets it to `/home`, and an unverified sign-in re-sends the verification link (`sendOnSignIn: true`) with that callback. The link would land on `/home`, which has no session and bounces to `/sign-in`. Sign-in must send `callbackURL: '/verify-email?status=success'` for the 403 case, so the re-sent link lands on the success state. (A successful sign-in still goes to `/home` by redirect.)
- Implementation note (found in step 4): Better Auth's default client redirect plugin follows `callbackURL` on any `redirect: true` response, so a successful email sign-in with the verify-email callback would navigate there instead of `/home`. `apps/web/src/lib/auth-client.ts` therefore sets `disableDefaultFetchPlugins: true` and registers `lib/social-redirect-plugin.ts`, which follows the redirect only for `/sign-in/social` (Google) and only for http(s) URLs, with unit tests. Email sign-in goes to `/home` through `router.replace`.
- Implementation note (found in manual check): a focused control that becomes `disabled` loses keyboard focus, so Tab restarted at the top of the page. `features/auth/use-restore-focus.ts` returns focus to the last focused control when a request ends, and all four forms and `ResendButton` use it. During the 60-second cooldown `ResendButton` uses `aria-disabled` instead of `disabled`. `ResetExpired` moves focus to its heading when the form swaps to it. Tests cover the hook, the tab order of each screen and focus after a failed request.
- Files outside `features/auth/` touched: `lib/auth-client.ts`, `lib/social-redirect-plugin.ts` and its test. `disableDefaultFetchPlugins: true` drops all default Better Auth fetch plugins; the app relied only on the redirect plugin, and `socialRedirectPlugin` replaces it.
- One-line API change in `apps/api/src/modules/auth/auth.ts`: `revokeSessionsOnPasswordReset: true`, with an integration test.
- EN and ES copy under the `auth` namespace in `packages/i18n/src/messages/{en,es}.json`.
- Error mapping for 429 and network errors on resend, forgot and reset, reusing `map-auth-error.ts`.
- Vitest tests for schemas, cooldown hook, pending-email helper and the three forms.
- Tick M2.4 in `ROADMAP.md`.

**Out of scope (for future specs):**

- Auto sign-in after verification or after reset.
- Server-side rate limiting (M2.6). The UI only handles a 429.
- Email change flow, resend from outside `/verify-email`.
- Changing the email templates (SPEC 08).
- Onboarding redirect after first sign-in (M2.5).
- Playwright e2e (no e2e setup exists).

## Data model

No database changes. New code-level contracts:

```ts
// packages/shared/src/auth.ts
export const emailOnlySchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const resetPasswordSchema = z
  .object({
    password: z.string().min(8).max(128),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'] });

// apps/web/src/features/auth/pending-email.ts
// sessionStorage key: 'verso:pending-verification-email'
```

Conventions:

- The pending email lives only in `sessionStorage`, never in a URL, cookie or log. If the key is missing (new tab), the verify-email pending state shows an email field instead of the address.
- Resend cooldown is 60 seconds. The end timestamp is stored in `sessionStorage` under `verso:resend-until`, so a reload keeps the countdown.
- Verify-email query states: `?status=success` is success; any `error` query (Better Auth appends it to `callbackURL` on a bad token) is expired; none is pending.
- Forgot password calls the Better Auth client's request-password-reset method with `redirectTo: '/reset-password'`. Better Auth then redirects the link to `/reset-password?token=...`, or `?error=INVALID_TOKEN`. The method name depends on the installed version (`requestPasswordReset` or `forgetPassword`); use the one that exists in the pinned version.
- Reset calls the client's `resetPassword({ newPassword, token })`.
- Neither screen reveals whether an email has an account. Forgot password shows the same neutral message on success and on a not-found response.

## Implementation plan

1. Add `emailOnlySchema` and `resetPasswordSchema` with unit tests, plus the new EN and ES copy. Verify: `pnpm --filter shared test` and the i18n key-parity test.
2. Create `pending-email.ts` and `use-resend-cooldown.ts` with unit tests (fake timers). Verify: `pnpm --filter web test`.
3. Build the verify-email page with its three states and `ResendButton`. Verify: opening `/verify-email`, `/verify-email?status=success` and `/verify-email?error=invalid_token` shows each state.
4. Change `SignUpForm` and `SignInForm` to save the pending email and redirect to `/verify-email`, remove the inline notices, and set the new `callbackURL` on both sign-up and sign-in (see Scope). Update the `signIn.email` argument assertion in the SPEC 09 test. Update their tests. Verify: sign up, land on `/verify-email` showing the address, open the Mailpit link, see the success state.
5. Build forgot-password with the neutral result state. Verify: request a reset for a known and an unknown email; the screen is identical; Mailpit receives one email only for the known one.
6. Build reset-password with token handling, the invalid-link state and the redirect to `/sign-in?reset=success`, plus the sign-in success notice. Verify: complete a reset from the Mailpit link and sign in with the new password.
7. Add `revokeSessionsOnPasswordReset: true` in `auth.ts` with an integration test. Verify: `pnpm --filter api test`.
8. Tick M2.4 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [x] Submitting sign-up redirects to `/verify-email` and shows the entered email.
- [x] A sign-in `403` redirects to `/verify-email`, shows the email, and a new verification email appears in Mailpit.
- [x] The inline notices from SPEC 09 no longer exist in the forms.
- [x] The verification link re-sent by a `403` sign-in lands on `/verify-email?status=success`, not on `/home` (the `signIn.email` call sends that `callbackURL`).
- [x] "Resend email" sends one verification email and then disables itself with a visible countdown of 60 seconds.
- [x] Reloading `/verify-email` during the countdown keeps the remaining time.
- [x] Opening the Mailpit verification link lands on `/verify-email?status=success` with a "Sign in" button, and the user can then sign in.
- [x] `/verify-email?error=invalid_token` shows the expired-link state with a Resend action.
- [x] `/verify-email` without a stored email shows an email field instead of an address.
- [x] The pending email never appears in the URL.
- [x] Forgot password with a known email shows the neutral message and sends one email; with an unknown email it shows the same message and sends none.
- [x] Reset password with a valid token and matching passwords redirects to `/sign-in?reset=success`, which shows a success notice.
- [x] Reset password with mismatched passwords or fewer than 8 characters shows a field error and sends no request.
- [x] `/reset-password` without a token, or with `?error=INVALID_TOKEN`, shows the expired-link state with a link to `/forgot-password`.
- [x] After a reset, an older session of the same user is no longer valid (API integration test).
- [x] A 429 or a network failure on resend, forgot and reset shows a message and keeps the typed values.
- [x] Every string comes from `packages/i18n` and exists in EN and ES.
- [x] No raw hex colors and no emojis. Icons have text labels, except show/hide which has an `aria-label`.
- [x] All three screens work with the keyboard, inputs have labels, and status changes are announced (`aria-live`).
- [x] Reduced motion is respected for the countdown and transitions.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] The M2.4 checkbox in `ROADMAP.md` is ticked in the same PR.

- [x] A verified email sign-in lands on `/home`, not on `/verify-email`, and Google sign-in still redirects to the provider (plugin unit test and manual check).
- [x] Tab order follows reading order on all five auth screens, and focus is not lost after a failed request, during the Resend cooldown or when the reset form shows the expired state.

### UI states: Verify email

- [x] **Normal:** pending, success and expired states each render with their copy and action.
- [x] **Loading:** the Resend button shows a pending state while the request runs; no layout jump.
- [x] **Empty:** no stored email shows the email field.
- [x] **Error:** a failed resend (429 or network) shows a message and allows retry after the cooldown rules.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** no horizontal scroll, touch targets at least 44px.
- [x] **Desktop:** works at desktop width.

### UI states: Forgot password

- [x] **Normal:** email field and submit.
- [x] **Loading:** pending submit and disabled field.
- [x] **Empty:** the neutral "If an account exists, we sent a link" result with a link back to Sign in.
- [x] **Error:** 429 or network failure shows a message and keeps the typed email.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** no horizontal scroll.
- [x] **Desktop:** works at desktop width.

### UI states: Reset password

- [x] **Normal:** new password with strength hint, confirm, submit.
- [x] **Loading:** pending submit.
- [x] **Empty:** N/A, a form has no empty state; empty fields show validation errors on submit.
- [x] **Error:** expired or invalid link state, plus 429 and network messages.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** no horizontal scroll.
- [x] **Desktop:** works at desktop width.

## Decisions

- **Yes:** pending email in `sessionStorage`. Chosen by the user. A query param would put the address in URLs, history and hosting logs.
- **Yes:** verification success is a state of `/verify-email` with a "Sign in" button, no auto sign-in. Chosen by the user. Auto sign-in needs an API change for little gain.
- **Yes:** replace the SPEC 09 inline notices with a redirect to `/verify-email`. Chosen by the user. One verification experience, as DESIGN P2 describes.
- **Yes:** reset redirects to `/sign-in?reset=success` and revokes other sessions with `revokeSessionsOnPasswordReset: true`. Chosen by the user. A reset often follows a suspected compromise.
- **No:** auto sign-in after reset. Not supported by default and not asked for.
- **Yes (mine, unconfirmed):** 60-second resend cooldown stored in `sessionStorage`, so a reload does not bypass it. It is a UI courtesy; real limits come in M2.6.
- **Yes (mine, unconfirmed):** the same neutral message for known and unknown emails on forgot password, matching DESIGN and SPEC 08, which sends no email for unknown addresses.
- **Yes (mine, unconfirmed):** any `error` query on `/verify-email` is treated as an expired link. Better Auth's error codes are not stable enough to branch on.
- **No:** a `?email=` query on `/verify-email`. See the first decision.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Better Auth redirect params (`error`, `token`) differ in the pinned version | Verify against the real Mailpit links in steps 3, 5 and 6, and note any difference in the PR |
| Client method name for password reset request differs by version | Use the one exported by the pinned version; covered by the form test |
| `sessionStorage` is unavailable (private mode) | Wrap reads and writes in try/catch; fall back to the email field and an in-memory cooldown |
| User opens the verification link in another browser | The success state does not need the stored email, so it still works |
| Cold start delays the first resend | Existing waking banner (SPEC 05) and pending button state |

## What is **not** in this spec

- Auto sign-in after verification or reset.
- Server-side rate limiting (M2.6).
- Onboarding and `/v1/me` (M2.5).
- Changes to email templates.
- Playwright e2e.
