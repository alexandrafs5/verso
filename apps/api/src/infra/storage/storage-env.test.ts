import { describe, expect, it } from 'vitest';
import { loadStorageEnv } from './storage-env.js';

describe('loadStorageEnv', () => {
  it('accepts empty Supabase vars and defaults the bucket', () => {
    const env = loadStorageEnv({
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
      SUPABASE_BUCKET: '',
    });
    expect(env.SUPABASE_URL).toBeUndefined();
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(env.SUPABASE_BUCKET).toBe('verso');
  });

  it('accepts a configured project', () => {
    const env = loadStorageEnv({
      SUPABASE_URL: 'https://abc.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'key',
      SUPABASE_BUCKET: 'custom',
    });
    expect(env.SUPABASE_URL).toBe('https://abc.supabase.co');
    expect(env.SUPABASE_BUCKET).toBe('custom');
  });

  it('rejects a malformed SUPABASE_URL', () => {
    expect(() => loadStorageEnv({ SUPABASE_URL: 'not a url' })).toThrow(
      /Invalid storage environment/,
    );
  });
});
