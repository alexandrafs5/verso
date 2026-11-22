import { describe, expect, it } from 'vitest';
import { redactUrl, serializeRequest } from './redact-request.js';

describe('redactUrl', () => {
  it('drops the query string', () => {
    expect(redactUrl('/api/auth/verify-email?token=abc&callbackURL=%2F')).toBe(
      '/api/auth/verify-email',
    );
  });

  it('masks the token in the reset-password path', () => {
    expect(redactUrl('/api/auth/reset-password/abc123?callbackURL=%2Fx')).toBe(
      '/api/auth/reset-password/[Redacted]',
    );
  });

  it('leaves plain paths alone', () => {
    expect(redactUrl('/health')).toBe('/health');
    expect(redactUrl('/api/auth/reset-password')).toBe('/api/auth/reset-password');
  });
});

describe('serializeRequest', () => {
  it('keeps id, method and headers, and logs no query or params', () => {
    const logged = serializeRequest({
      id: 7,
      method: 'GET',
      url: '/api/auth/verify-email?token=secret',
      headers: { host: 'x' },
    });
    expect(logged).toMatchObject({ id: 7, method: 'GET', url: '/api/auth/verify-email' });
    expect(JSON.stringify(logged)).not.toContain('secret');
    expect(logged).not.toHaveProperty('query');
    expect(logged).not.toHaveProperty('params');
  });
});
