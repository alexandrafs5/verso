/**
 * Fixed genre list (SPEC 18). `subject` is the Open Library subject string used as the
 * `?genre=` value in search. Chip labels are translated in `packages/i18n` under
 * `genres.<slug>`; `name` is English only and is stored in `Genre.name`.
 */
export const GENRES = [
  { slug: 'fiction', name: 'Fiction', subject: 'Fiction' },
  { slug: 'fantasy', name: 'Fantasy', subject: 'Fantasy' },
  { slug: 'science-fiction', name: 'Science fiction', subject: 'Science fiction' },
  { slug: 'mystery', name: 'Mystery', subject: 'Mystery and detective stories' },
  { slug: 'romance', name: 'Romance', subject: 'Romance' },
  { slug: 'historical-fiction', name: 'Historical fiction', subject: 'Historical fiction' },
  { slug: 'horror', name: 'Horror', subject: 'Horror' },
  { slug: 'thriller', name: 'Thriller', subject: 'Thrillers' },
  { slug: 'biography', name: 'Biography', subject: 'Biography' },
  { slug: 'history', name: 'History', subject: 'History' },
  { slug: 'poetry', name: 'Poetry', subject: 'Poetry' },
  { slug: 'philosophy', name: 'Philosophy', subject: 'Philosophy' },
] as const;

export type GenreSlug = (typeof GENRES)[number]['slug'];

export type GenreChip = { slug: GenreSlug; subject: string };

const norm = (value: string): string => value.trim().toLowerCase();

const BY_KEY = new Map<string, (typeof GENRES)[number]>();
for (const genre of GENRES) {
  BY_KEY.set(norm(genre.subject), genre);
  BY_KEY.set(norm(genre.name), genre);
}

/**
 * Maps raw genre strings of a work to chips. Matches `subject` or `name`, case-insensitive.
 * Keeps the order of the raw list, drops duplicates and strings that map to nothing.
 */
export function mapWorkGenres(raw: readonly string[]): GenreChip[] {
  const seen = new Set<GenreSlug>();
  const chips: GenreChip[] = [];
  for (const value of raw) {
    const genre = BY_KEY.get(norm(value));
    if (!genre || seen.has(genre.slug)) continue;
    seen.add(genre.slug);
    chips.push({ slug: genre.slug, subject: genre.subject });
  }
  return chips;
}
