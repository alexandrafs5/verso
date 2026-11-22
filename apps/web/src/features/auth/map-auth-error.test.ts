import { describe, expect, it } from 'vitest';
import { mapAuthError } from './map-auth-error';

describe('mapAuthError', () => {
  it('maps invalid credentials by code', () => {
    expect(mapAuthError({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'invalidCredentials',
    );
  });

  it('maps a bare 401 to invalid credentials', () => {
    expect(mapAuthError({ status: 401 })).toBe('invalidCredentials');
  });

  it('maps an unverified email by code or by 403', () => {
    expect(mapAuthError({ status: 403, code: 'EMAIL_NOT_VERIFIED' })).toBe('unverified');
    expect(mapAuthError({ status: 403 })).toBe('unverified');
  });

  it('maps both user-already-exists codes to email in use', () => {
    expect(mapAuthError({ status: 422, code: 'USER_ALREADY_EXISTS' })).toBe('emailInUse');
    expect(mapAuthError({ status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe(
      'emailInUse',
    );
  });

  it('maps 429 to rate limited, ahead of any code', () => {
    expect(mapAuthError({ status: 429 })).toBe('rateLimited');
    expect(mapAuthError({ status: 429, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe('rateLimited');
  });

  it('maps a thrown error and status 0 to network', () => {
    expect(mapAuthError(new TypeError('Failed to fetch'))).toBe('network');
    expect(mapAuthError({ status: 0 })).toBe('network');
  });

  it('maps unknown codes, 5xx, null and strings to generic', () => {
    expect(mapAuthError({ status: 500, code: 'SOMETHING_NEW' })).toBe('generic');
    expect(mapAuthError({ status: 400, code: 'SOMETHING_NEW' })).toBe('generic');
    expect(mapAuthError(null)).toBe('generic');
    expect(mapAuthError(undefined)).toBe('generic');
    expect(mapAuthError('boom')).toBe('generic');
  });
});
