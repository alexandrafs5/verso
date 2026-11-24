import { describe, expect, it } from 'vitest';
import { GENRES, mapWorkGenres } from './genres';

describe('GENRES', () => {
  it('has 12 entries with unique slug and unique subject', () => {
    expect(GENRES).toHaveLength(12);
    expect(new Set(GENRES.map((g) => g.slug)).size).toBe(12);
    expect(new Set(GENRES.map((g) => g.subject.toLowerCase())).size).toBe(12);
  });
});

describe('mapWorkGenres', () => {
  it('maps case-insensitively, keeps raw order and drops duplicates and unknown strings', () => {
    expect(mapWorkGenres(['fiction', 'Fantasy', 'Zoology', 'FICTION'])).toEqual([
      { slug: 'fiction', subject: 'Fiction' },
      { slug: 'fantasy', subject: 'Fantasy' },
    ]);
  });

  it('returns an empty list for an empty input', () => {
    expect(mapWorkGenres([])).toEqual([]);
  });

  it('matches the English name and the subject, and trims the input', () => {
    expect(mapWorkGenres(['  Mystery and detective stories '])).toEqual([
      { slug: 'mystery', subject: 'Mystery and detective stories' },
    ]);
    expect(mapWorkGenres(['Mystery', 'thrillers', 'Thriller'])).toEqual([
      { slug: 'mystery', subject: 'Mystery and detective stories' },
      { slug: 'thriller', subject: 'Thrillers' },
    ]);
  });
});
