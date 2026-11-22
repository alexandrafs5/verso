import { afterEach, describe, expect, it, vi } from 'vitest';
import { socialRedirectPlugin } from './social-redirect-plugin';

function stubLocation() {
  const location = { href: 'http://localhost:3000/sign-in' };
  vi.stubGlobal('window', { location });
  return location;
}

describe('socialRedirectPlugin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('follows the provider URL after social sign-in', () => {
    const location = stubLocation();
    socialRedirectPlugin.hooks.onSuccess({
      data: { url: 'https://accounts.google.com/o/oauth2', redirect: true },
      request: { url: 'http://localhost:3000/api/auth/sign-in/social' },
    });
    expect(location.href).toBe('https://accounts.google.com/o/oauth2');
  });

  it('does not follow the callback after email sign-in', () => {
    const location = stubLocation();
    socialRedirectPlugin.hooks.onSuccess({
      data: { url: '/verify-email?status=success', redirect: true },
      request: { url: 'http://localhost:3000/api/auth/sign-in/email' },
    });
    expect(location.href).toBe('http://localhost:3000/sign-in');
  });

  it('ignores a non-http target', () => {
    const location = stubLocation();
    socialRedirectPlugin.hooks.onSuccess({
      data: { url: 'javascript:alert(1)', redirect: true },
      request: { url: 'http://localhost:3000/api/auth/sign-in/social' },
    });
    expect(location.href).toBe('http://localhost:3000/sign-in');
  });
});
