import { describe, expect, it } from 'vitest';
import { buildUserAgent, loadCatalogEnv } from './catalog-env.js';

describe('loadCatalogEnv', () => {
  it('uses the configured contact', () => {
    expect(loadCatalogEnv({ OPEN_LIBRARY_CONTACT: 'me@example.org' })).toEqual({
      OPEN_LIBRARY_CONTACT: 'me@example.org',
    });
  });

  it('falls back to a placeholder outside production', () => {
    expect(loadCatalogEnv({}).OPEN_LIBRARY_CONTACT).toBe('dev@verso.local');
    expect(loadCatalogEnv({ NODE_ENV: 'development' }).OPEN_LIBRARY_CONTACT).toBe(
      'dev@verso.local',
    );
    expect(loadCatalogEnv({ NODE_ENV: 'test' }).OPEN_LIBRARY_CONTACT).toBe('dev@verso.local');
  });

  it('treats an empty or blank contact as unset', () => {
    expect(loadCatalogEnv({ OPEN_LIBRARY_CONTACT: '' }).OPEN_LIBRARY_CONTACT).toBe(
      'dev@verso.local',
    );
    expect(loadCatalogEnv({ OPEN_LIBRARY_CONTACT: '   ' }).OPEN_LIBRARY_CONTACT).toBe(
      'dev@verso.local',
    );
  });

  it('fails in production when the contact is missing or empty', () => {
    expect(() => loadCatalogEnv({ NODE_ENV: 'production' })).toThrow(/OPEN_LIBRARY_CONTACT/);
    expect(() => loadCatalogEnv({ NODE_ENV: 'production', OPEN_LIBRARY_CONTACT: '' })).toThrow(
      /OPEN_LIBRARY_CONTACT/,
    );
  });

  it('boots in production with a contact', () => {
    expect(
      loadCatalogEnv({ NODE_ENV: 'production', OPEN_LIBRARY_CONTACT: 'ops@example.org' })
        .OPEN_LIBRARY_CONTACT,
    ).toBe('ops@example.org');
  });
});

describe('buildUserAgent', () => {
  it('formats the Open Library User-Agent', () => {
    expect(buildUserAgent('me@example.org')).toBe('Verso/1.0 (me@example.org)');
  });
});
