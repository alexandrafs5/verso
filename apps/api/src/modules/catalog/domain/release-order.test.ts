import { describe, expect, it } from 'vitest';
import { releaseYear, sortByReleaseYear } from './release-order';

const work = (title: string, typicalYear: number | null, firstPublishYear: number | null) => ({
  title,
  typicalYear,
  firstPublishYear,
});

describe('releaseYear', () => {
  it('prefers the typical year and falls back to the first publish year', () => {
    expect(releaseYear(work('a', 2020, 2011))).toBe(2020);
    expect(releaseYear(work('a', null, 2011))).toBe(2011);
    expect(releaseYear({ firstPublishYear: 1999 })).toBe(1999);
    expect(releaseYear(work('a', null, null))).toBeNull();
  });
});

describe('sortByReleaseYear', () => {
  it('orders by typical year, so a stray early first year does not break the order', () => {
    // Open Library dates the first edition of Rhythm of War in 2011, but it came out in 2020.
    const sorted = sortByReleaseYear([
      work('Rhythm of War', 2020, 2011),
      work('Words of Radiance', 2014, 2012),
      work('The Way of Kings', 2010, 2010),
      work('Oathbringer', 2017, 2017),
    ]).map((w) => w.title);
    expect(sorted).toEqual([
      'The Way of Kings',
      'Words of Radiance',
      'Oathbringer',
      'Rhythm of War',
    ]);
  });

  it('puts unknown years last and breaks ties by title', () => {
    const sorted = sortByReleaseYear([
      work('Undated', null, null),
      work('B', 2001, 2001),
      work('A', 2001, 2001),
    ]).map((w) => w.title);
    expect(sorted).toEqual(['A', 'B', 'Undated']);
  });

  it('does not change the input', () => {
    const input = [work('b', 2002, 2002), work('a', 2001, 2001)];
    sortByReleaseYear(input);
    expect(input.map((w) => w.title)).toEqual(['b', 'a']);
  });
});
