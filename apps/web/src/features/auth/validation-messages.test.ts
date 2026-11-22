import { describe, expect, it } from 'vitest';
import { validationKey } from './validation-messages';

describe('validationKey', () => {
  it('returns undefined when there is no issue', () => {
    expect(validationKey('email', undefined, 'a@b.co')).toBeUndefined();
  });

  it('distinguishes an empty email from an invalid one', () => {
    expect(validationKey('email', 'invalid_format', '   ')).toBe('emailRequired');
    expect(validationKey('email', 'invalid_format', 'nope')).toBe('emailInvalid');
  });

  it('maps password issues', () => {
    expect(validationKey('password', 'too_small', '')).toBe('passwordRequired');
    expect(validationKey('password', 'too_small', 'short')).toBe('passwordTooShort');
    expect(validationKey('password', 'too_big', 'x'.repeat(129))).toBe('passwordTooLong');
  });

  it('maps name issues', () => {
    expect(validationKey('name', 'too_small', '')).toBe('nameRequired');
    expect(validationKey('name', 'too_big', 'x'.repeat(81))).toBe('nameTooLong');
  });
});
