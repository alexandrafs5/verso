export type UsernameInvalidReason = 'TOO_SHORT' | 'TOO_LONG' | 'INVALID_CHARACTERS' | 'RESERVED';

export type UsernameResult =
  { ok: true; username: string } | { ok: false; reason: UsernameInvalidReason };

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  'admin',
  'api',
  'settings',
  'u',
  'me',
  'home',
  'search',
  'library',
  'works',
  'authors',
  'series',
  'stats',
  'notifications',
  'books',
  'import',
  'onboarding',
  'verso',
  'support',
  'help',
  'null',
  'undefined',
]);

const ALLOWED_CHARACTERS = /^[a-z0-9_]+$/;

export class UsernamePolicy {
  static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  static validate(raw: string): UsernameResult {
    const username = UsernamePolicy.normalize(raw);

    if (!ALLOWED_CHARACTERS.test(username)) {
      // An empty string is too short, not a character problem.
      if (username.length === 0) return { ok: false, reason: 'TOO_SHORT' };
      return { ok: false, reason: 'INVALID_CHARACTERS' };
    }
    // Reserved is checked before length so short reserved words (`u`, `me`) report RESERVED.
    if (RESERVED_USERNAMES.has(username)) return { ok: false, reason: 'RESERVED' };
    if (username.length < USERNAME_MIN_LENGTH) return { ok: false, reason: 'TOO_SHORT' };
    if (username.length > USERNAME_MAX_LENGTH) return { ok: false, reason: 'TOO_LONG' };

    return { ok: true, username };
  }
}
