import { describe, expect, it } from 'vitest';
import { matchAcceptLanguage, resolveLocale } from './locales';

describe('matchAcceptLanguage', () => {
  it('returns null for missing or unsupported headers', () => {
    expect(matchAcceptLanguage(null)).toBeNull();
    expect(matchAcceptLanguage('')).toBeNull();
    expect(matchAcceptLanguage('fr-FR,de;q=0.8')).toBeNull();
  });

  it('maps regional tags to the base language', () => {
    expect(matchAcceptLanguage('es-MX')).toBe('es');
    expect(matchAcceptLanguage('EN-gb')).toBe('en');
  });

  it('honors q-values over order', () => {
    expect(matchAcceptLanguage('en;q=0.5,es;q=0.9')).toBe('es');
  });

  it('skips unsupported languages and q=0', () => {
    expect(matchAcceptLanguage('fr,es;q=0,en;q=0.4')).toBe('en');
  });
});

describe('resolveLocale', () => {
  it('prefers a valid cookie over the header', () => {
    expect(resolveLocale({ cookie: 'es', acceptLanguage: 'en' })).toBe('es');
  });

  it('ignores an invalid cookie', () => {
    expect(resolveLocale({ cookie: 'xx', acceptLanguage: 'es' })).toBe('es');
  });

  it('falls back to English', () => {
    expect(resolveLocale({})).toBe('en');
    expect(resolveLocale({ acceptLanguage: 'fr' })).toBe('en');
  });
});
