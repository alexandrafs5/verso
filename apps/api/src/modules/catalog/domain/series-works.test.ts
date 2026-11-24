import { describe, expect, it } from 'vitest';
import type { WorkSearchResult } from '../../../infra/catalog/catalog-provider.js';
import { isSeriesJunkTitle, mainAuthor, selectSeriesWorks } from './series-works';

const work = (
  key: string,
  title: string,
  editionCount: number,
  authorKey = 'OL1A',
): WorkSearchResult => ({
  olWorkKey: key,
  title,
  authors: [{ olAuthorKey: authorKey, name: `Author ${authorKey}` }],
  firstPublishYear: 2010,
  coverUrl: null,
  editionCount,
  languages: [],
});

describe('isSeriesJunkTitle', () => {
  it.each([
    'Words of Radiance, Part Two',
    'The Way of Kings Part One',
    'Oathbringer part 1',
    'The Stormlight Archive Series 6 Books Collection Set by Brandon Sanderson',
    'Stormlight Archive MM Boxed Set I, Books 1-3',
    'Stormlight Archive, Books 1-4',
    'Stormlight Archives HC Boxed Set 1-4',
    'A Song of Ice and Fire (A Game of Thrones / A Clash of Kings)',
    'Harry Potter Omnibus',
    'Series Bundle With Gift Journal',
    'Stormlight Archive Series Collection 4 Books Bundles Set',
  ])('flags %s', (title) => {
    expect(isSeriesJunkTitle(title)).toBe(true);
  });

  it.each([
    'The Way of Kings',
    'Words of Radiance',
    'Rhythm of War',
    'Dawnshard',
    'A Game of Thrones',
    'The Hobbit',
  ])('keeps %s', (title) => {
    expect(isSeriesJunkTitle(title)).toBe(false);
  });
});

describe('mainAuthor', () => {
  it('returns the most frequent author, ties to the first seen, and null without authors', () => {
    expect(
      mainAuthor([work('1', 'a', 5, 'OL2A'), work('2', 'b', 5, 'OL1A'), work('3', 'c', 5, 'OL1A')])
        ?.olAuthorKey,
    ).toBe('OL1A');
    expect(mainAuthor([work('1', 'a', 5, 'OL2A'), work('2', 'b', 5, 'OL1A')])?.olAuthorKey).toBe(
      'OL2A',
    );
    expect(mainAuthor([])).toBeNull();
    expect(mainAuthor([{ ...work('1', 'a', 5), authors: [] }])).toBeNull();
  });
});

describe('selectSeriesWorks', () => {
  it('keeps tagged works, even with few editions, but not junk titles', () => {
    const result = selectSeriesWorks({
      tagged: [work('1', 'Book One', 1), work('2', 'Book Two Part One', 9)],
      textMatches: [],
      authorKey: 'OL1A',
    });
    expect(result.map((w) => w.olWorkKey)).toEqual(['1']);
  });

  it('adds text matches only by the main author, with enough editions and a clean title', () => {
    const result = selectSeriesWorks({
      tagged: [work('1', 'Book One', 30)],
      textMatches: [
        work('2', 'Book Two', 23),
        work('3', 'Book Three', 4),
        work('4', 'Collection Set', 20),
        work('5', 'Study Guide', 20, 'OL9A'),
        work('6', 'Book Four', 5),
      ],
      authorKey: 'OL1A',
    });
    expect(result.map((w) => w.olWorkKey)).toEqual(['1', '2', '6']);
  });

  it('does not repeat a work found by several searches and keeps the tagged one first', () => {
    const result = selectSeriesWorks({
      tagged: [work('1', 'Book One', 30)],
      textMatches: [work('1', 'Book One', 30), work('2', 'Book Two', 10)],
      authorKey: 'OL1A',
    });
    expect(result.map((w) => w.olWorkKey)).toEqual(['1', '2']);
  });

  it('adds no text match when the main author is unknown', () => {
    const result = selectSeriesWorks({
      tagged: [],
      textMatches: [work('1', 'Book One', 30)],
      authorKey: null,
    });
    expect(result).toEqual([]);
  });
});
