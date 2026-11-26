import { describe, expect, it } from 'vitest';
import { bookStatusSchema, tagColorSchema } from './library.js';

describe('bookStatusSchema', () => {
  it.each(['READING', 'READ', 'WANT_TO_READ', 'ABANDONED'])('accepts %s', (status) => {
    expect(bookStatusSchema.parse(status)).toBe(status);
  });

  it('rejects any other string', () => {
    expect(bookStatusSchema.safeParse('PAUSED').success).toBe(false);
    expect(bookStatusSchema.safeParse('read').success).toBe(false);
  });
});

describe('tagColorSchema', () => {
  it.each(['WINE', 'TOBACCO', 'BRASS', 'FOREST', 'NAVY', 'OXBLOOD', 'SLATE', 'SAND'])(
    'accepts %s',
    (color) => {
      expect(tagColorSchema.parse(color)).toBe(color);
    },
  );

  it('rejects any other string', () => {
    expect(tagColorSchema.safeParse('PINK').success).toBe(false);
    expect(tagColorSchema.safeParse('wine').success).toBe(false);
  });
});
