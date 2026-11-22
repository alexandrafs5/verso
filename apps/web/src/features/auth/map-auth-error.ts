export type AuthErrorKind =
  'invalidCredentials' | 'unverified' | 'emailInUse' | 'rateLimited' | 'network' | 'generic';

type ErrorShape = { status?: unknown; code?: unknown };

/**
 * Maps a Better Auth client error (or a thrown fetch error) to a copy key under `auth.errors`.
 * Better Auth error codes are matched loosely and fall back to the HTTP status, so a renamed
 * code degrades to a sensible message instead of a blank one. Messages never reveal which of
 * email or password was wrong.
 */
export function mapAuthError(error: unknown): AuthErrorKind {
  if (error === null || error === undefined) return 'generic';

  const { status, code } = (typeof error === 'object' ? error : {}) as ErrorShape;
  const httpStatus = typeof status === 'number' ? status : null;
  const errorCode = typeof code === 'string' ? code : '';

  // A thrown error without an HTTP status is a failed request (offline, DNS, CORS, abort).
  if (httpStatus === null) return error instanceof Error ? 'network' : 'generic';
  if (httpStatus === 0) return 'network';

  if (httpStatus === 429) return 'rateLimited';
  if (errorCode === 'EMAIL_NOT_VERIFIED' || httpStatus === 403) return 'unverified';
  if (errorCode.startsWith('USER_ALREADY_EXISTS')) return 'emailInUse';
  if (errorCode === 'INVALID_EMAIL_OR_PASSWORD' || httpStatus === 401) return 'invalidCredentials';
  return 'generic';
}
