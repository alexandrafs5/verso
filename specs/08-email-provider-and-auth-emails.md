# SPEC 08 — EmailProvider and auth emails (M2.3)

> **Status:** Approved
> **Depends on:** SPEC 06, SPEC 07
> **Date:** 2026-11-22
> **Objective:** Add an `EmailProvider` interface with Mailpit (SMTP) and Brevo (HTTP) implementations and use it to send localized (EN/ES) verification and password-reset emails from Better Auth.

## Scope

**In:**

- `apps/api/src/infra/email/`: `email.provider.ts` (interface, `EmailMessage`, DI token), `smtp-email.provider.ts`, `brevo-email.provider.ts`, `in-memory-email.provider.ts` (test fake), `email.module.ts`, `email-env.ts` (Zod env schema).
- Provider selection at boot: `BREVO_API_KEY` set means Brevo; otherwise `SMTP_URL` means SMTP; in production with no `BREVO_API_KEY` the boot fails.
- `apps/api/src/infra/email/templates/`: `verification` and `password-reset` templates in `en` and `es`, each producing subject, HTML and plain text. Brand-neutral, no images, no emojis.
- Replace `logEmailStub` in `auth.ts` with `AuthEmailService`, which resolves the locale and calls `EmailProvider.send`.
- Enforce verified email for email + password sign-in (`requireEmailVerification: true`). Google users are already verified.
- Update `auth.integration.test.ts` so existing tests verify the user (or read the link from the fake) before signing in.
- New dependency `nodemailer` (+ `@types/nodemailer`) for SMTP. Brevo uses `fetch`, no dependency.
- Env: `SMTP_URL`, `EMAIL_FROM`, `BREVO_API_KEY` already exist in `.env.example`; validate them at startup.
- Tick M2.3 in `ROADMAP.md`.

**Out of scope (for future specs):**

- `email.send` pg-boss job with retries (M9.1 introduces `JobQueue`). Here the send is direct and failures are logged.
- Sign-in, verify and reset screens (M2.4). The links point at the existing Better Auth endpoints, which redirect to `callbackURL`.
- Rate limiting of email-triggering routes (M2.6).
- Any non-auth email (notifications, import finished).
- Email change flow, unsubscribe links, custom sender domain (ADR-008: single sender).
- Live Brevo delivery (verified manually in M12.5).

## Data model

This feature introduces no database changes. New code-level contract:

```ts
type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

interface EmailProvider {
  send(message: EmailMessage): Promise<void>;
}

type EmailLocale = 'en' | 'es'; // same values as the User.locale enum
```

Conventions:

- `EMAIL_FROM` format is `Name <address>`; both providers parse it.
- Locale resolution order: first supported language in the request `Accept-Language` header, then `user.locale`, then `en`. Sign-up always stores `locale = en` (SPEC 07), so `Accept-Language` is what makes the verification email Spanish at sign-up.
- Templates are pure functions `(locale, { name, url }) => EmailMessage` without `to`. They contain the URL as given by Better Auth, never one built by hand.
- The email body never includes the password or any token other than the one inside the URL.

## Implementation plan

1. Create `email.provider.ts` (interface, token) and `in-memory-email.provider.ts`, with a unit test for the fake. Verify: `pnpm --filter api typecheck`.
2. Create the templates and a unit test: each template, in each locale, returns non-empty subject, HTML and text that contain the URL and the user's name, and the HTML escapes the name. Verify: `pnpm --filter api test`.
3. Create `smtp-email.provider.ts` with `nodemailer`, plus `email-env.ts` and `email.module.ts` with the selection rule. Unit test the selection rule. Verify: sending through the SMTP provider to Mailpit shows the message at `http://localhost:8025`.
4. Create `brevo-email.provider.ts` (`POST https://api.brevo.com/v3/smtp/email`, header `api-key`, 10 s timeout, non-2xx throws). Unit test with a stubbed `fetch`. Verify: tests pass.
5. Create `AuthEmailService` and wire it into `createAuth`, replacing `logEmailStub`. Hooks do not `await` the send; errors are caught and logged without the address or URL. Set `requireEmailVerification: true`. Verify: sign up locally and read the email in Mailpit.
6. Update `auth.integration.test.ts` to use the in-memory provider, and add the cases in the acceptance criteria. Verify: `pnpm --filter api test`.
7. Tick M2.3 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [ ] With only `SMTP_URL` set, a sign-up delivers a verification email visible in Mailpit.
- [ ] With `BREVO_API_KEY` set, `BrevoEmailProvider` sends a `POST` to the Brevo endpoint with the `api-key` header and the sender, recipient, subject and both bodies (stubbed `fetch` test).
- [ ] A non-2xx Brevo response makes `send` reject.
- [ ] With `NODE_ENV=production` and no `BREVO_API_KEY`, the API fails to boot with a clear error.
- [ ] Sign-up with `Accept-Language: es` sends the verification email in Spanish; without the header it is in English.
- [ ] A password-reset request for an existing user sends one email in the user's `locale` (or `Accept-Language` when present) containing a link that starts with `BETTER_AUTH_URL`.
- [ ] A password-reset request for an unknown email sends no email.
- [ ] Sign-in with email + password before verification is rejected with 403 and sends a new verification email.
- [ ] Sign-in succeeds after opening the verification link.
- [ ] If `EmailProvider.send` rejects, sign-up still returns 200 and creates the user, and the error is logged without the recipient address or URL.
- [ ] The HTML of both templates escapes HTML characters in the user's name.
- [ ] No log line at `info` or above contains a verification or reset URL.
- [ ] `auth.ts` no longer contains `logEmailStub`.
- [ ] `.env.example` still lists every email variable, with a comment on which provider each selects.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] The M2.3 checkbox in `ROADMAP.md` is ticked in the same PR.

UI states: N/A, this spec touches no screen or component. Email layout is checked manually in Mailpit in light and dark mail clients by the user.

## Decisions

- **Yes:** two real providers behind one interface, chosen by env at boot, as ARCHITECTURE §7 and ADR-008 say. Tests use the in-memory fake (CLAUDE.md).
- **Yes:** `nodemailer` for SMTP. One-line reason for the PR: Node has no SMTP client, and it is only used locally.
- **No:** Brevo SDK. A single `fetch` call does the job without a dependency.
- **Yes:** direct send inside the Better Auth hooks, not awaited. Awaiting slows the response and leaks whether an account exists through timing.
- **No:** `email.send` pg-boss job now. `JobQueue` arrives in M9.1; the retry behavior moves there.
- **Yes:** enforce `requireEmailVerification`. SPEC 06 deferred this to M2.3, and the ROADMAP "done when" for M2 says users verify.
- **No:** leave verification unenforced. It would make the verification email decorative.
- **Yes:** templates live in `apps/api/src/infra/email/templates/` as typed TS, not in `packages/i18n`. Emails are rendered server-side and are not UI text; this avoids a new `apps/api` dependency on the i18n package.
- **Yes:** locale from `Accept-Language`, then `User.locale`. Sign-up stores `en` regardless of the browser language, so the header is the only signal at sign-up.
- **Yes:** plain brand-neutral HTML with a text alternative, inline styles only, no remote images.
- **Yes:** quick definition without detailed clarification, requested by the user ("corto"). Enforcing verification, template location, locale resolution and the `nodemailer` choice are mine and unconfirmed.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Enforced verification locks out sign-in until M2.4 ships the verify screen | During the gap, open the link from Mailpit; the Better Auth verify endpoint works without a screen. Accepted until M2.4 |
| Better Auth hook signature does not expose the request, so `Accept-Language` is unavailable | The hooks receive `request` as second argument; if it is missing in 1.7.27, fall back to `user.locale` and report it instead of changing the approach |
| Brevo free sender must be verified, so production sends can fail silently | Errors are logged; M12.5 smoke test sends a real email |
| Unawaited send hides failures on Render cold starts | Accepted. Retries arrive with `email.send` in M9.1 |

## What is **not** in this spec

- The `email.send` job, retries or `JobQueue`.
- Any web screen or `auth-client.ts`.
- Rate limiting.
- Non-auth emails, unsubscribe links or a custom sender domain.
- Real Brevo delivery tests.
