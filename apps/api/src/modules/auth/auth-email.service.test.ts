import { Logger } from '@nestjs/common';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { AuthEmailService, resolveEmailLocale } from './auth-email.service.js';

describe('resolveEmailLocale', () => {
  it('prefers Accept-Language over the user locale', () => {
    expect(resolveEmailLocale('es-ES,es;q=0.9', 'en')).toBe('es');
  });

  it('honors q-values', () => {
    expect(resolveEmailLocale('fr;q=0.9,en;q=0.5,es;q=0.8', null)).toBe('es');
  });

  it('skips unsupported languages and q=0', () => {
    expect(resolveEmailLocale('fr,de;q=0.8,es;q=0', 'es')).toBe('es');
    expect(resolveEmailLocale('fr,es;q=0,en;q=0.1', 'es')).toBe('en');
  });

  it('falls back to the user locale, then en', () => {
    expect(resolveEmailLocale(undefined, 'es')).toBe('es');
    expect(resolveEmailLocale('fr', 'de')).toBe('en');
    expect(resolveEmailLocale(null, null)).toBe('en');
  });
});

describe('AuthEmailService', () => {
  const url = 'http://localhost:3000/api/auth/verify-email?token=secret-token';
  const user = { email: 'maria@example.com', name: 'Maria', locale: 'en' };

  afterEach(() => vi.restoreAllMocks());

  const request = (acceptLanguage: string) =>
    new Request('http://localhost', { headers: { 'accept-language': acceptLanguage } });

  it('sends the verification email in the request language', async () => {
    const provider = new InMemoryEmailProvider();
    new AuthEmailService(provider).sendVerification(user, url, request('es'));
    await vi.waitFor(() => expect(provider.sent).toHaveLength(1));
    expect(provider.sent[0]?.to).toBe(user.email);
    expect(provider.sent[0]?.html).toContain('lang="es"');
    expect(provider.sent[0]?.text).toContain(url);
  });

  it('sends the password-reset email in the user locale without Accept-Language', async () => {
    const provider = new InMemoryEmailProvider();
    new AuthEmailService(provider).sendPasswordReset({ ...user, locale: 'es' }, url);
    await vi.waitFor(() => expect(provider.sent).toHaveLength(1));
    expect(provider.sent[0]?.html).toContain('lang="es"');
  });

  it('logs failures without the recipient address or the URL', async () => {
    const provider = new InMemoryEmailProvider();
    provider.failWith = new Error(`rejected ${user.email} for ${url}`);
    const logged = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    new AuthEmailService(provider).sendVerification(user, url);
    await vi.waitFor(() => expect(logged).toHaveBeenCalledTimes(1));

    const line = String(logged.mock.calls[0]?.[0]);
    expect(line).not.toContain(user.email);
    expect(line).not.toContain(url);
    expect(line).not.toContain('secret-token');
  });

  it('does not throw synchronously when the provider rejects', () => {
    const provider = new InMemoryEmailProvider();
    provider.failWith = new Error('boom');
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    expect(() => new AuthEmailService(provider).sendVerification(user, url)).not.toThrow();
  });
});
