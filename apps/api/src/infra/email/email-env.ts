import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const emailEnvSchema = z.object({
  SMTP_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  BREVO_API_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),
  NODE_ENV: z.string().optional(),
});

export type EmailEnv = z.infer<typeof emailEnvSchema>;
export type EmailProviderKind = 'brevo' | 'smtp';
export type EmailSender = { name?: string; email: string };

/** Validates the email env vars. Throws a readable error so a bad config fails the boot. */
export function loadEmailEnv(source: NodeJS.ProcessEnv = process.env): EmailEnv {
  const result = emailEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid email environment: ${details}`);
  }
  return result.data;
}

/**
 * BREVO_API_KEY set means Brevo; otherwise SMTP_URL means SMTP.
 * Production never uses SMTP (Render Free blocks it), so it requires BREVO_API_KEY.
 */
export function selectEmailProviderKind(env: EmailEnv): EmailProviderKind {
  if (env.BREVO_API_KEY) return 'brevo';
  if (env.NODE_ENV === 'production') {
    throw new Error('BREVO_API_KEY is required when NODE_ENV=production (SMTP is not allowed)');
  }
  if (env.SMTP_URL) return 'smtp';
  throw new Error('No email provider configured: set BREVO_API_KEY or SMTP_URL');
}

/** Parses `Name <address>` (or a bare address) into its parts. */
export function parseSender(from: string): EmailSender {
  const match = /^\s*(?:"?([^"<]*?)"?\s*)?<([^<>\s]+)>\s*$/.exec(from);
  if (match) {
    const email = match[2] as string;
    const name = match[1]?.trim();
    return name ? { name, email } : { email };
  }
  return { email: from.trim() };
}
