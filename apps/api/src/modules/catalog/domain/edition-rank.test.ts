import { describe, expect, it } from 'vitest';
import { editionScore, rankEditions, type RankableEdition } from './edition-rank';

const stub: RankableEdition = {
  coverUrl: null,
  isbn10: null,
  isbn13: null,
  publisher: null,
  publishYear: null,
  language: null,
  pageCount: null,
};
const edition = (id: string, extra: Partial<RankableEdition> = {}) => ({ id, ...stub, ...extra });

describe('editionScore', () => {
  it('scores a stub 0 and a complete edition 10', () => {
    expect(editionScore(stub)).toBe(0);
    expect(
      editionScore({
        coverUrl: 'c',
        isbn10: null,
        isbn13: '9788437604947',
        publisher: 'p',
        publishYear: 1955,
        language: 'es',
        pageCount: 128,
      }),
    ).toBe(10);
  });

  it('counts the ISBN once, whichever one it is', () => {
    expect(editionScore({ ...stub, isbn10: '0802133908' })).toBe(2);
    expect(editionScore({ ...stub, isbn10: '0802133908', isbn13: '9780802133908' })).toBe(2);
  });
});

describe('rankEditions', () => {
  it('puts editions with a cover and an ISBN before bare stubs', () => {
    const ranked = rankEditions([
      edition('stub'),
      edition('isbn-only', { isbn13: '1' }),
      edition('full', { coverUrl: 'c', isbn13: '1', publisher: 'p', pageCount: 10 }),
      edition('cover-only', { coverUrl: 'c' }),
    ]);
    expect(ranked.map((e) => e.id)).toEqual(['full', 'cover-only', 'isbn-only', 'stub']);
  });

  it('keeps the provider order for equal scores', () => {
    const ranked = rankEditions([edition('a'), edition('b'), edition('c')]);
    expect(ranked.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('does not change the input array', () => {
    const input = [edition('a'), edition('b', { coverUrl: 'c' })];
    rankEditions(input);
    expect(input.map((e) => e.id)).toEqual(['a', 'b']);
  });
});
