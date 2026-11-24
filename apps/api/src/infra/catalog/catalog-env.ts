import { z } from 'zod';

const DEV_CONTACT = 'dev@verso.local';

const emptyToUndefined = (value: unknown): unknown =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const catalogEnvSchema = z.object({
  OPEN_LIBRARY_CONTACT: z.preprocess(emptyToUndefined, z.string().trim().optional()),
  NODE_ENV: z.string().optional(),
});

export type CatalogEnv = {
  /** Contact shown in the Open Library User-Agent. */
  OPEN_LIBRARY_CONTACT: string;
};

/**
 * Validates the catalog env vars. Production requires OPEN_LIBRARY_CONTACT so the
 * User-Agent identifies us; other environments fall back to a placeholder.
 */
export function loadCatalogEnv(source: NodeJS.ProcessEnv = process.env): CatalogEnv {
  const result = catalogEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid catalog environment: ${details}`);
  }
  const { OPEN_LIBRARY_CONTACT, NODE_ENV } = result.data;
  if (OPEN_LIBRARY_CONTACT) return { OPEN_LIBRARY_CONTACT };
  if (NODE_ENV === 'production') {
    throw new Error('OPEN_LIBRARY_CONTACT is required when NODE_ENV=production');
  }
  return { OPEN_LIBRARY_CONTACT: DEV_CONTACT };
}

export function buildUserAgent(contact: string): string {
  return `Verso/1.0 (${contact})`;
}
