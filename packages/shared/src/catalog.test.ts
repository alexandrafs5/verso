import { describe, expect, it } from 'vitest';
import {
  authorRefSchema,
  editionsQuerySchema,
  isbnResultSchema,
  searchBooksQuerySchema,
  searchBooksResponseSchema,
  seriesIdSchema,
  workDetailSchema,
  workRefSchema,
} from './catalog';

const UUID = '0190f0f0-1234-7abc-8def-0123456789ab';

const edition = {
  ref: 'ol:OL1M',
  title: 'Pedro Páramo',
  isbn10: null,
  isbn13: '9788437604947',
  publisher: null,
  publishYear: 1955,
  language: 'es',
  pageCount: 128,
  format: 'PAPERBACK',
  coverUrl: null,
  isOriginalLanguage: true,
};

describe('refs', () => {
  it('accepts a UUID and an Open Library work key', () => {
    expect(workRefSchema.safeParse(UUID).success).toBe(true);
    expect(workRefSchema.safeParse('ol:OL1731119W').success).toBe(true);
  });

  it('rejects malformed work refs', () => {
    for (const bad of ['OL1731119W', 'ol:OL1731119A', 'ol:OLW', 'ol:OL12W/x', '../x', '']) {
      expect(workRefSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('accepts author keys and rejects work keys as author refs', () => {
    expect(authorRefSchema.safeParse('ol:OL9A').success).toBe(true);
    expect(authorRefSchema.safeParse('ol:OL9W').success).toBe(false);
  });

  it('series id is a UUID or ol:<name>', () => {
    expect(seriesIdSchema.safeParse(UUID).success).toBe(true);
    expect(seriesIdSchema.safeParse('ol:A Song of Ice and Fire').success).toBe(true);
    expect(seriesIdSchema.safeParse('ol:').success).toBe(false);
    expect(seriesIdSchema.safeParse('ol:   ').success).toBe(false);
    expect(seriesIdSchema.safeParse(`ol:${'a'.repeat(121)}`).success).toBe(false);
    expect(seriesIdSchema.safeParse(`ol:a${String.fromCharCode(7)}b`).success).toBe(false);
    expect(seriesIdSchema.safeParse('not-a-series').success).toBe(false);
  });
});

describe('searchBooksQuerySchema', () => {
  it('trims q', () => {
    expect(searchBooksQuerySchema.parse({ q: '  Pedro  ' })).toEqual({ q: 'Pedro' });
  });

  it('rejects empty, blank and too long q', () => {
    expect(searchBooksQuerySchema.safeParse({ q: '' }).success).toBe(false);
    expect(searchBooksQuerySchema.safeParse({ q: '   ' }).success).toBe(false);
    expect(searchBooksQuerySchema.safeParse({ q: 'a'.repeat(201) }).success).toBe(false);
    expect(searchBooksQuerySchema.safeParse({ q: 'a'.repeat(200) }).success).toBe(true);
  });

  it('rejects genre over 80 characters', () => {
    expect(searchBooksQuerySchema.safeParse({ q: 'a', genre: 'g'.repeat(81) }).success).toBe(false);
  });

  it('accepts q only, genre only and both, and rejects neither', () => {
    expect(searchBooksQuerySchema.safeParse({ q: 'dune' }).success).toBe(true);
    expect(searchBooksQuerySchema.parse({ genre: ' Fiction ' })).toEqual({ genre: 'Fiction' });
    expect(searchBooksQuerySchema.safeParse({ q: 'dune', genre: 'Fiction' }).success).toBe(true);
    expect(searchBooksQuerySchema.safeParse({}).success).toBe(false);
    expect(searchBooksQuerySchema.safeParse({ cursor: 'abc' }).success).toBe(false);
  });
});

describe('editionsQuerySchema', () => {
  it('accepts a two-letter language and rejects others', () => {
    expect(editionsQuerySchema.safeParse({ language: 'es' }).success).toBe(true);
    expect(editionsQuerySchema.safeParse({ language: 'spa' }).success).toBe(false);
    expect(editionsQuerySchema.safeParse({}).success).toBe(true);
  });
});

describe('response shapes', () => {
  it('parses a search response and keeps libraryStatus null', () => {
    const item = {
      ref: 'ol:OL1W',
      title: 'Pedro Páramo',
      authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
      firstPublishYear: 1955,
      coverUrl: null,
      editionCount: 12,
      libraryStatus: null,
    };
    expect(
      searchBooksResponseSchema.safeParse({ items: [item], moreMatches: [], nextCursor: null })
        .success,
    ).toBe(true);
    expect(
      searchBooksResponseSchema.safeParse({
        items: [{ ...item, libraryStatus: 'READING' }],
        moreMatches: [],
        nextCursor: null,
      }).success,
    ).toBe(false);
    expect(
      searchBooksResponseSchema.safeParse({ items: [item], moreMatches: [item], nextCursor: null })
        .success,
    ).toBe(true);
    expect(searchBooksResponseSchema.safeParse({ items: [item], nextCursor: null }).success).toBe(
      false,
    );
  });

  it('caps genres at 8', () => {
    const base = {
      ref: UUID,
      title: 't',
      subtitle: null,
      description: null,
      firstPublishYear: null,
      coverUrl: null,
      authors: [],
      series: null,
      source: 'MANUAL',
      libraryStatus: null,
    };
    expect(workDetailSchema.safeParse({ ...base, genres: Array(8).fill('g') }).success).toBe(true);
    expect(workDetailSchema.safeParse({ ...base, genres: Array(9).fill('g') }).success).toBe(false);
  });

  it('parses an ISBN result', () => {
    expect(isbnResultSchema.safeParse({ workRef: 'ol:OL1W', edition }).success).toBe(true);
  });
});
