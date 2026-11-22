import { describe, expect, it } from 'vitest';
import { emailOnlySchema, resetPasswordSchema, signInSchema, signUpSchema } from './auth.js';

describe('emailOnlySchema', () => {
  it('normalizes the email to trimmed lowercase', () => {
    expect(emailOnlySchema.parse({ email: '  Ana@Example.COM ' }).email).toBe('ana@example.com');
  });

  it('rejects an invalid or empty email', () => {
    expect(emailOnlySchema.safeParse({ email: 'nope' }).success).toBe(false);
    expect(emailOnlySchema.safeParse({ email: '' }).success).toBe(false);
  });
});

describe('resetPasswordSchema', () => {
  const valid = { password: 'longenough', confirmPassword: 'longenough' };

  it('accepts matching passwords of valid length', () => {
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    const r = resetPasswordSchema.safeParse({ password: '1234567', confirmPassword: '1234567' });
    expect(r.success).toBe(false);
  });

  it('rejects a password longer than 128 characters', () => {
    const long = 'a'.repeat(129);
    expect(resetPasswordSchema.safeParse({ password: long, confirmPassword: long }).success).toBe(
      false,
    );
  });

  it('reports a mismatch on confirmPassword', () => {
    const r = resetPasswordSchema.safeParse({ ...valid, confirmPassword: 'different1' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.path).toEqual(['confirmPassword']);
  });
});

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
