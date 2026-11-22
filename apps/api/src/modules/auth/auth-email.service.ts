import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  EMAIL_PROVIDER,
  type EmailLocale,
  type EmailProvider,
} from '../../infra/email/email.provider.js';
import { passwordResetEmail } from '../../infra/email/templates/password-reset.js';
import { verificationEmail } from '../../infra/email/templates/verification.js';

const SUPPORTED: readonly EmailLocale[] = ['en', 'es'];

export type AuthEmailRecipient = { email: string; name: string; locale?: string | null };

function isSupported(value: string | null | undefined): value is EmailLocale {
  return SUPPORTED.includes(value as EmailLocale);
}

/** First supported language in an Accept-Language header, honoring q-values. */
function fromAcceptLanguage(header: string | null | undefined): EmailLocale | undefined {
  if (!header) return undefined;
  const candidates = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...params] = part.trim().split(';');
      const qParam = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qParam ? Number(qParam.slice(2)) : 1;
      return { lang: tag.trim().toLowerCase().split('-')[0] ?? '', q, index };
    })
    .filter((c) => c.lang !== '' && Number.isFinite(c.q) && c.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  return candidates.map((c) => c.lang).find(isSupported);
}

/** Accept-Language first, then the user's stored locale, then English. */
export function resolveEmailLocale(
  acceptLanguage: string | null | undefined,
  userLocale: string | null | undefined,
): EmailLocale {
  return fromAcceptLanguage(acceptLanguage) ?? (isSupported(userLocale) ? userLocale : 'en');
}

@Injectable()
export class AuthEmailService {
  private readonly logger = new Logger(AuthEmailService.name);

  constructor(@Inject(EMAIL_PROVIDER) private readonly provider: EmailProvider) {}

  /** Fire and forget: never awaited by the Better Auth hooks (no slowdown, no timing leak). */
  sendVerification(user: AuthEmailRecipient, url: string, request?: Request): void {
    const locale = resolveEmailLocale(request?.headers.get('accept-language'), user.locale);
    this.dispatch('verification', user.email, url, {
      ...verificationEmail(locale, { name: user.name, url }),
    });
  }

  sendPasswordReset(user: AuthEmailRecipient, url: string, request?: Request): void {
    const locale = resolveEmailLocale(request?.headers.get('accept-language'), user.locale);
    this.dispatch('password reset', user.email, url, {
      ...passwordResetEmail(locale, { name: user.name, url }),
    });
  }

  private dispatch(
    kind: string,
    to: string,
    url: string,
    content: { subject: string; html: string; text: string },
  ): void {
    this.provider.send({ to, ...content }).catch((error: unknown) => {
      this.logger.error(`Failed to send ${kind} email: ${describeError(error, [to, url])}`);
    });
  }
}

/** Error text with the recipient address and URL removed. */
function describeError(error: unknown, secrets: string[]): string {
  const raw = error instanceof Error ? `${error.name}: ${error.message}` : 'unknown error';
  return secrets.reduce(
    (text, secret) => (secret ? text.split(secret).join('[redacted]') : text),
    raw,
  );
}
