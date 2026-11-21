import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe.js';

const schema = z.object({ title: z.string().min(1), pages: z.coerce.number().int().positive() });

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(schema);

  it('returns the parsed value (with coercions applied)', () => {
    expect(pipe.transform({ title: 'Dune', pages: '412' })).toEqual({ title: 'Dune', pages: 412 });
  });

  it('throws a ZodError with a path per invalid field', () => {
    try {
      pipe.transform({ title: '', pages: -1 });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(ZodError);
      const paths = (error as ZodError).issues.map((i) => i.path.join('.'));
      expect(paths).toEqual(['title', 'pages']);
    }
  });

  it('rejects a missing body', () => {
    expect(() => pipe.transform(undefined)).toThrow(ZodError);
  });
});
