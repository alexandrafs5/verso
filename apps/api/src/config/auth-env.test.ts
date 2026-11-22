import { describe, expect, it } from 'vitest';
import { loadAuthEnv } from './auth-env.js';

const base = { BETTER_AUTH_SECRET: 'secret' };

describe('loadAuthEnv rate limit settings', () => {
  it('defaults to enabled with a max of 10', () => {
    const env = loadAuthEnv(base);
    expect(env.AUTH_RATE_LIMIT_ENABLED).toBe(true);
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(10);
  });

  it('treats empty values as defaults', () => {
    const env = loadAuthEnv({
      ...base,
      AUTH_RATE_LIMIT_ENABLED: '',
      AUTH_RATE_LIMIT_MAX: '',
    });
    expect(env.AUTH_RATE_LIMIT_ENABLED).toBe(true);
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(10);
  });

  it('parses the "false" string as disabled', () => {
    const env = loadAuthEnv({ ...base, AUTH_RATE_LIMIT_ENABLED: 'false' });
    expect(env.AUTH_RATE_LIMIT_ENABLED).toBe(false);
  });

  it('parses "true" as enabled', () => {
    const env = loadAuthEnv({ ...base, AUTH_RATE_LIMIT_ENABLED: 'true' });
    expect(env.AUTH_RATE_LIMIT_ENABLED).toBe(true);
  });

  it('reads a custom max', () => {
    const env = loadAuthEnv({ ...base, AUTH_RATE_LIMIT_MAX: '3' });
    expect(env.AUTH_RATE_LIMIT_MAX).toBe(3);
  });

  it.each(['abc', '0', '-1', '1.5'])('fails boot on invalid max %s', (max) => {
    expect(() => loadAuthEnv({ ...base, AUTH_RATE_LIMIT_MAX: max })).toThrow(
      /Invalid auth environment/,
    );
  });

  it('fails boot on an invalid enabled flag', () => {
    expect(() => loadAuthEnv({ ...base, AUTH_RATE_LIMIT_ENABLED: 'maybe' })).toThrow(
      /Invalid auth environment/,
    );
  });
});
