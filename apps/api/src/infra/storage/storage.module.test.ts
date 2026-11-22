import { describe, expect, it } from 'vitest';
import { StorageNotConfiguredError } from './file-storage.js';
import { loadStorageEnv } from './storage-env.js';
import { createFileStorage } from './storage.module.js';
import { SupabaseFileStorage } from './supabase-file-storage.js';

describe('createFileStorage', () => {
  it('builds without Supabase vars and fails only when used', async () => {
    const storage = createFileStorage(loadStorageEnv({}));
    await expect(storage.createUploadUrl('a', 'image/webp')).rejects.toBeInstanceOf(
      StorageNotConfiguredError,
    );
    await expect(storage.delete('a')).rejects.toBeInstanceOf(StorageNotConfiguredError);
    expect(() => storage.publicUrl('a')).toThrow(StorageNotConfiguredError);
  });

  it('builds the Supabase storage when configured', () => {
    const env = loadStorageEnv({
      SUPABASE_URL: 'https://abc.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
    });
    expect(createFileStorage(env)).toBeInstanceOf(SupabaseFileStorage);
  });
});
