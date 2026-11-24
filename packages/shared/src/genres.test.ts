import { describe, expect, it } from 'vitest';
import { GENRES, MAX_GENRE_CHIPS, mapWorkGenres } from './genres';

const slugs = (raw: string[]) => mapWorkGenres(raw).map((chip) => chip.slug);

describe('GENRES', () => {
  it('has unique slugs and unique subjects', () => {
    expect(GENRES).toHaveLength(23);
    expect(new Set(GENRES.map((g) => g.slug)).size).toBe(GENRES.length);
    expect(new Set(GENRES.map((g) => g.subject.toLowerCase())).size).toBe(GENRES.length);
  });

  it('puts the generic genres after the specific ones', () => {
    const order = GENRES.map((g) => g.slug);
    expect(order.indexOf('science-fiction')).toBeLessThan(order.indexOf('science'));
    expect(order.indexOf('science-fiction')).toBeLessThan(order.indexOf('fiction'));
    expect(order.indexOf('fantasy')).toBeLessThan(order.indexOf('fiction'));
    expect(order.indexOf('historical-fiction')).toBeLessThan(order.indexOf('history'));
    expect(order.indexOf('children')).toBeLessThan(order.indexOf('fiction'));
  });
});

describe('mapWorkGenres', () => {
  it('maps case-insensitively, keeps raw order and drops duplicates', () => {
    expect(mapWorkGenres(['fiction', 'Fantasy', 'FICTION'])).toEqual([
      { slug: 'fiction', subject: 'Fiction' },
      { slug: 'fantasy', subject: 'Fantasy' },
    ]);
  });

  it('returns an empty list for an empty input', () => {
    expect(mapWorkGenres([])).toEqual([]);
  });

  it('matches the English name and the subject, and trims the input', () => {
    expect(slugs(['  Mystery and detective stories '])).toEqual(['mystery']);
    expect(slugs(['Mystery', 'thrillers', 'Thriller'])).toEqual(['mystery', 'thriller']);
  });

  it('maps free-text subjects by keyword, most specific genre first', () => {
    expect(slugs(['Fiction, fantasy, epic'])).toEqual(['fantasy']);
    expect(slugs(['High Fantasy'])).toEqual(['fantasy']);
    expect(slugs(['Science fiction, American'])).toEqual(['science-fiction']);
    expect(slugs(['Juvenile fiction'])).toEqual(['children']);
    expect(slugs(['Biographies', 'Autobiography'])).toEqual(['biography']);
    expect(slugs(['Philosophy, Modern'])).toEqual(['philosophy']);
    expect(slugs(['Historical fiction'])).toEqual(['historical-fiction']);
    expect(slugs(['World history'])).toEqual(['history']);
    expect(slugs(['Ficción'])).toEqual(['fiction']);
    expect(slugs(['Psychological thrillers'])).toEqual(['thriller']);
  });

  it('does not match inside another word', () => {
    // "art" must not match "artificial", "science" must not match "conscience".
    expect(slugs(['Artificial intelligence', 'Conscience'])).toEqual([null, null]);
  });

  it('keeps at most 5 chips', () => {
    const raw = ['Fantasy', 'Mystery', 'Horror', 'Romance', 'Poetry', 'History', 'Humor'];
    expect(mapWorkGenres(raw)).toHaveLength(MAX_GENRE_CHIPS);
  });

  it('falls back to the first usable raw subjects when no genre matches', () => {
    expect(
      mapWorkGenres([
        'Accessible book',
        'Protected DAISY',
        'nyt:hardcover-fiction=2012-01-01',
        'Moral Ambiguity',
        'moral ambiguity',
        'Politics',
        'Betrayal',
      ]),
    ).toEqual([
      { slug: null, subject: 'Moral Ambiguity' },
      { slug: null, subject: 'Politics' },
    ]);
  });

  it('gives no chip when there are no usable subjects', () => {
    expect(mapWorkGenres(['Accessible book', 'in library', '1955', 'Protected DAISY'])).toEqual([]);
  });

  it('does not use the raw fallback when a genre matched', () => {
    expect(mapWorkGenres(['Politics', 'Fantasy'])).toEqual([
      { slug: 'fantasy', subject: 'Fantasy' },
    ]);
  });
});
