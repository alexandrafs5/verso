import { describe, expect, it } from 'vitest';
import { ErrorCode, problemSchema } from './problem.js';

describe('problemSchema', () => {
  it('accepts a minimal problem', () => {
    const result = problemSchema.safeParse({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: ErrorCode.NOT_FOUND,
    });
    expect(result.success).toBe(true);
  });

  it('accepts a validation problem with errors[]', () => {
    const result = problemSchema.safeParse({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
      errors: [{ path: 'email', message: 'Invalid email' }],
    });
    expect(result.success).toBe(true);
  });

  it('rejects an unknown code', () => {
    const result = problemSchema.safeParse({
      type: 'about:blank',
      title: 'Boom',
      status: 500,
      code: 'NOPE',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a non-integer status', () => {
    const result = problemSchema.safeParse({
      type: 'about:blank',
      title: 'Boom',
      status: 500.5,
      code: ErrorCode.INTERNAL_ERROR,
    });
    expect(result.success).toBe(false);
  });

  it('rejects malformed errors[] entries', () => {
    const result = problemSchema.safeParse({
      type: 'about:blank',
      title: 'Validation failed',
      status: 400,
      code: ErrorCode.VALIDATION_ERROR,
      errors: [{ path: 'email' }],
    });
    expect(result.success).toBe(false);
  });
});
