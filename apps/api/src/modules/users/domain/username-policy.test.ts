import { describe, expect, it } from 'vitest';
import { RESERVED_USERNAMES, UsernamePolicy } from './username-policy.js';

describe('UsernamePolicy.normalize', () => {
  it('trims and lowercases', () => {
    expect(UsernamePolicy.normalize('  Maria_01 ')).toBe('maria_01');
  });
});

describe('UsernamePolicy.validate', () => {
  it('normalizes before validating', () => {
    expect(UsernamePolicy.validate('  Maria_01 ')).toEqual({ ok: true, username: 'maria_01' });
  });

  it('accepts the boundary lengths 3 and 20', () => {
    expect(UsernamePolicy.validate('ab_')).toEqual({ ok: true, username: 'ab_' });
    const twenty = 'a'.repeat(19) + '1';
    expect(UsernamePolicy.validate(twenty)).toEqual({ ok: true, username: twenty });
  });

  it('rejects 2 characters with TOO_SHORT', () => {
    expect(UsernamePolicy.validate('ab')).toEqual({ ok: false, reason: 'TOO_SHORT' });
  });

  it('rejects an empty or blank string with TOO_SHORT', () => {
    expect(UsernamePolicy.validate('')).toEqual({ ok: false, reason: 'TOO_SHORT' });
    expect(UsernamePolicy.validate('   ')).toEqual({ ok: false, reason: 'TOO_SHORT' });
  });

  it('rejects 21 characters with TOO_LONG', () => {
    expect(UsernamePolicy.validate('a'.repeat(21))).toEqual({ ok: false, reason: 'TOO_LONG' });
  });

  it.each([
    ['space', 'ma ria'],
    ['hyphen', 'ma-ria'],
    ['dot', 'ma.ria'],
    ['accent', 'maría'],
    ['emoji', 'maria😀'],
  ])('rejects %s with INVALID_CHARACTERS', (_label, value) => {
    expect(UsernamePolicy.validate(value)).toEqual({ ok: false, reason: 'INVALID_CHARACTERS' });
  });

  it.each([...RESERVED_USERNAMES])('rejects reserved word %s with RESERVED', (word) => {
    expect(UsernamePolicy.validate(word)).toEqual({ ok: false, reason: 'RESERVED' });
  });

  it('rejects reserved words case-insensitively', () => {
    expect(UsernamePolicy.validate('ADMIN')).toEqual({ ok: false, reason: 'RESERVED' });
  });

  it('reports RESERVED, not TOO_SHORT, for reserved words under 3 characters', () => {
    expect(UsernamePolicy.validate('U')).toEqual({ ok: false, reason: 'RESERVED' });
    expect(UsernamePolicy.validate('me')).toEqual({ ok: false, reason: 'RESERVED' });
  });
});
