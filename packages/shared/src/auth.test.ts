import { describe, expect, it } from 'vitest';
import { signInSchema, signUpSchema } from './auth.js';

describe('signInSchema', () => {
  it('normalizes the email to trimmed lowercase', () => {
    const result = signInSchema.parse({ email: '  Ana@Example.COM ', password: 'x' });
    expect(result.email).toBe('ana@example.com');
  });

  it('rejects an invalid email', () => {
    expect(signInSchema.safeParse({ email: 'not-an-email', password: 'x' }).success).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
  });

  it('does not enforce the minimum length on sign-in', () => {
    expect(signInSchema.safeParse({ email: 'a@b.co', password: 'short' }).success).toBe(true);
  });
});

describe('signUpSchema', () => {
  const valid = { name: 'Ana', email: 'ana@example.com', password: 'longenough' };

  it('accepts valid input', () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(signUpSchema.safeParse({ ...valid, password: '1234567' }).success).toBe(false);
  });

  it('accepts a password of exactly 8 and 128 characters', () => {
    expect(signUpSchema.safeParse({ ...valid, password: 'a'.repeat(8) }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...valid, password: 'a'.repeat(128) }).success).toBe(true);
  });

  it('rejects a password longer than 128 characters', () => {
    expect(signUpSchema.safeParse({ ...valid, password: 'a'.repeat(129) }).success).toBe(false);
  });

  it('rejects a blank or too long name', () => {
    expect(signUpSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...valid, name: 'a'.repeat(81) }).success).toBe(false);
  });
});
