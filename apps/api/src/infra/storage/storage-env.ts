import { z } from 'zod';

const emptyToUndefined = (value: unknown): unknown => (value === '' ? undefined : value);

// All optional: the API boots without Supabase. Storage only fails when it is used.
const storageEnvSchema = z.object({
  SUPABASE_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  SUPABASE_SERVICE_ROLE_KEY: z.preprocess(emptyToUndefined, z.string().min(1).optional()),
  SUPABASE_BUCKET: z.preprocess(emptyToUndefined, z.string().min(1).default('verso')),
});

export type StorageEnv = z.infer<typeof storageEnvSchema>;

/** Validates the storage env vars. Throws a readable error so a malformed value fails the boot. */
export function loadStorageEnv(source: NodeJS.ProcessEnv = process.env): StorageEnv {
  const result = storageEnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid storage environment: ${details}`);
  }
  return result.data;
}
