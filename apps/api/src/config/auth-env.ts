import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

const authEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1, 'BETTER_AUTH_SECRET is required'),
  BETTER_AUTH_URL: z.string().url().default('http://localhost:3000'),
  WEB_ORIGIN: z.string().url().default('http://localhost:3000'),
  GOOGLE_CLIENT_ID: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  GOOGLE_CLIENT_SECRET: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  NODE_ENV: z.string().optional(),
});

export type AuthEnv = z.infer<typeof authEnvSchema>;

/** Validates the auth-related env vars. Throws a readable error so a bad config fails the boot. */
export function loadAuthEnv(source: NodeJS.ProcessEnv = process.env): AuthEnv {
  const result = authEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid auth environment: ${details}`);
  }
  return result.data;
}
