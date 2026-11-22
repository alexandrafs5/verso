import { describe, expect, it } from 'vitest';
import { loadEmailEnv, parseSender, selectEmailProviderKind } from './email-env.js';

const FROM = 'Verso <no-reply@verso.local>';
const SMTP = 'smtp://localhost:1025';
const env = (vars: Record<string, string>) => loadEmailEnv({ EMAIL_FROM: FROM, ...vars });

describe('selectEmailProviderKind', () => {
  it('selects smtp when only SMTP_URL is set', () => {
    expect(selectEmailProviderKind(env({ SMTP_URL: SMTP }))).toBe('smtp');
  });

  it('selects brevo when BREVO_API_KEY is set, even with SMTP_URL', () => {
    expect(selectEmailProviderKind(env({ SMTP_URL: SMTP, BREVO_API_KEY: 'key' }))).toBe('brevo');
  });

  it('treats an empty BREVO_API_KEY as unset', () => {
    expect(selectEmailProviderKind(env({ SMTP_URL: SMTP, BREVO_API_KEY: '' }))).toBe('smtp');
  });

  it('selects brevo in production', () => {
    expect(selectEmailProviderKind(env({ NODE_ENV: 'production', BREVO_API_KEY: 'key' }))).toBe(
      'brevo',
    );
  });

  it('fails in production without BREVO_API_KEY, even with SMTP_URL', () => {
    expect(() => selectEmailProviderKind(env({ NODE_ENV: 'production', SMTP_URL: SMTP }))).toThrow(
      /BREVO_API_KEY is required/,
    );
  });

  it('fails when nothing is configured', () => {
    expect(() => selectEmailProviderKind(env({}))).toThrow(/No email provider configured/);
  });
});

describe('loadEmailEnv', () => {
  it('fails when EMAIL_FROM is missing', () => {
    expect(() => loadEmailEnv({ SMTP_URL: SMTP })).toThrow(/EMAIL_FROM/);
  });

  it('fails when SMTP_URL is not a URL', () => {
    expect(() => env({ SMTP_URL: 'not a url' })).toThrow(/SMTP_URL/);
  });
});

describe('parseSender', () => {
  it('parses Name <address>', () => {
    expect(parseSender(FROM)).toEqual({ name: 'Verso', email: 'no-reply@verso.local' });
  });

  it('parses a quoted name', () => {
    expect(parseSender('"Verso Books" <no-reply@verso.local>')).toEqual({
      name: 'Verso Books',
      email: 'no-reply@verso.local',
    });
  });

  it('parses a bare address', () => {
    expect(parseSender('no-reply@verso.local')).toEqual({ email: 'no-reply@verso.local' });
  });

  it('parses an address in angle brackets without a name', () => {
    expect(parseSender('<no-reply@verso.local>')).toEqual({ email: 'no-reply@verso.local' });
  });
});
