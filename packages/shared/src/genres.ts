/**
 * Fixed genre list (SPEC 18). `subject` is the Open Library subject string used as the
 * `?genre=` value in search. `keywords` map the free-text subjects of a work to a genre: a
 * keyword matches a whole word of the subject, or any word starting with it when it ends in `*`.
 * The order is the priority: the first genre that matches a subject wins, so specific genres
 * come before generic ones (a "Science fiction" subject is science fiction, not science nor
 * fiction). Chip labels are translated in `packages/i18n` under `genres.<slug>`; `name` is
 * English only and is stored in `Genre.name`.
 */
export const GENRES = [
  {
    slug: 'historical-fiction',
    name: 'Historical fiction',
    subject: 'Historical fiction',
    keywords: ['historical fiction', 'historical novel*'],
  },
  {
    slug: 'science-fiction',
    name: 'Science fiction',
    subject: 'Science fiction',
    keywords: [
      'science fiction',
      'sci-fi',
      'scifi',
      'space opera',
      'dystopi*',
      'cyberpunk',
      'ciencia ficción',
    ],
  },
  { slug: 'fantasy', name: 'Fantasy', subject: 'Fantasy', keywords: ['fantasy', 'fantasía'] },
  {
    slug: 'mystery',
    name: 'Mystery',
    subject: 'Mystery and detective stories',
    keywords: ['mystery', 'mysteries', 'detective*', 'whodunit', 'crime fiction', 'misterio'],
  },
  {
    slug: 'thriller',
    name: 'Thriller',
    subject: 'Thrillers',
    keywords: ['thriller*', 'suspense', 'espionage', 'spy stories', 'spy fiction'],
  },
  { slug: 'horror', name: 'Horror', subject: 'Horror', keywords: ['horror', 'ghost stor*'] },
  {
    slug: 'romance',
    name: 'Romance',
    subject: 'Romance',
    keywords: ['romance', 'romances', 'love stories', 'love story'],
  },
  {
    slug: 'young-adult',
    name: 'Young adult',
    subject: 'Young adult fiction',
    keywords: ['young adult', 'teen*'],
  },
  {
    slug: 'children',
    name: "Children's",
    subject: 'Juvenile fiction',
    keywords: ["children's", 'children’s', 'children', 'childrens', 'juvenile*', 'picture book*'],
  },
  {
    slug: 'graphic-novels',
    name: 'Graphic novels',
    subject: 'Graphic novels',
    keywords: ['graphic novel*', 'comic', 'comics', 'manga'],
  },
  {
    slug: 'poetry',
    name: 'Poetry',
    subject: 'Poetry',
    keywords: ['poetry', 'poem', 'poems', 'poesía', 'poesia'],
  },
  {
    slug: 'philosophy',
    name: 'Philosophy',
    subject: 'Philosophy',
    keywords: ['philosoph*', 'filosofía'],
  },
  {
    slug: 'biography',
    name: 'Biography',
    subject: 'Biography',
    keywords: ['biograph*', 'autobiograph*', 'memoir*', 'biografía'],
  },
  {
    slug: 'history',
    name: 'History',
    subject: 'History',
    keywords: ['history', 'histories', 'historia'],
  },
  {
    slug: 'religion',
    name: 'Religion',
    subject: 'Religion',
    keywords: ['religio*', 'bible', 'christian*', 'islam*', 'buddhis*', 'spirituality', 'theolog*'],
  },
  {
    slug: 'psychology',
    name: 'Psychology',
    subject: 'Psychology',
    keywords: ['psycholog*', 'psicología'],
  },
  {
    slug: 'science',
    name: 'Science',
    subject: 'Science',
    keywords: [
      'science',
      'sciences',
      'physics',
      'biology',
      'chemistry',
      'mathematic*',
      'astronomy',
      'ciencia',
    ],
  },
  {
    slug: 'business',
    name: 'Business',
    subject: 'Business',
    keywords: ['business', 'economic*', 'management', 'entrepreneur*', 'finance'],
  },
  {
    slug: 'self-help',
    name: 'Self-help',
    subject: 'Self-help',
    keywords: ['self-help', 'self help', 'personal development', 'motivational'],
  },
  { slug: 'art', name: 'Art', subject: 'Art', keywords: ['art', 'arts', 'design', 'photograph*'] },
  {
    slug: 'humor',
    name: 'Humor',
    subject: 'Humor',
    keywords: ['humor', 'humour', 'humorous', 'comedy', 'satire'],
  },
  {
    slug: 'nonfiction',
    name: 'Nonfiction',
    subject: 'Nonfiction',
    keywords: ['nonfiction', 'non-fiction'],
  },
  {
    slug: 'fiction',
    name: 'Fiction',
    subject: 'Fiction',
    keywords: [
      'fiction',
      'novel',
      'novels',
      'short stories',
      'stories',
      'ficción',
      'ficcion',
      'novela',
    ],
  },
] as const;

export type GenreSlug = (typeof GENRES)[number]['slug'];

/**
 * A genre chip. `slug` is set for a genre of the fixed list (its label is translated, from
 * `genres.<slug>`). A chip with a null `slug` is a raw Open Library subject, shown as written, for
 * a work whose subjects match no genre of the list.
 */
export type GenreChip = { slug: GenreSlug | null; subject: string };

/** At most this many chips for a work. */
export const MAX_GENRE_CHIPS = 5;
/** At most this many raw subjects as chips, when no genre of the list matches. */
const MAX_RAW_CHIPS = 2;

const norm = (value: string): string => value.trim().toLowerCase();

const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `science fiction` is a whole phrase, `philosoph*` a word prefix. Both need a word start. */
function keywordPattern(keyword: string): RegExp {
  const prefix = keyword.endsWith('*');
  const body = escape(prefix ? keyword.slice(0, -1) : keyword);
  return new RegExp(`(?<![\\p{L}\\p{N}])${body}${prefix ? '' : '(?![\\p{L}\\p{N}])'}`, 'u');
}

const RULES = GENRES.map((genre) => ({
  genre,
  patterns: genre.keywords.map((keyword) => keywordPattern(keyword)),
}));

const BY_NAME = new Map<string, (typeof GENRES)[number]>();
for (const genre of GENRES) {
  BY_NAME.set(norm(genre.subject), genre);
  BY_NAME.set(norm(genre.name), genre);
}

/** Subjects that describe the catalog (lending, accessibility, lists), not the book. */
const NOT_A_GENRE =
  /accessible|daisy|large type|overdrive|lending|in library|internet archive|wishlist|staff picks|bestsell|new york times|reviewed|^[a-z_]+:/i;

function matchGenre(subject: string): (typeof GENRES)[number] | null {
  const text = norm(subject);
  const exact = BY_NAME.get(text);
  if (exact) return exact;
  return (
    RULES.find(({ patterns }) => patterns.some((pattern) => pattern.test(text)))?.genre ?? null
  );
}

function usableRawSubject(subject: string): boolean {
  const text = subject.trim();
  return (
    text.length >= 3 &&
    text.length <= 40 &&
    !/^[\d\s\W]+$/u.test(text) &&
    !text.includes('--') &&
    !text.includes('(') &&
    !NOT_A_GENRE.test(text)
  );
}

/**
 * Chips for the subjects of a work (SPEC 18), in the order of the subjects, without repeats, at
 * most {@link MAX_GENRE_CHIPS}. Each subject maps to the first genre of the list that it equals
 * or matches by keyword. When no subject matches, the first usable raw subjects become chips
 * (at most 2), so a work that has subjects always has a chip. A work with no subject has none.
 */
export function mapWorkGenres(raw: readonly string[]): GenreChip[] {
  const seen = new Set<GenreSlug>();
  const chips: GenreChip[] = [];
  for (const subject of raw) {
    // Catalog subjects ("Accessible book", "nyt:hardcover-fiction=...") say nothing about the book.
    if (NOT_A_GENRE.test(subject.trim())) continue;
    const genre = matchGenre(subject);
    if (!genre || seen.has(genre.slug)) continue;
    seen.add(genre.slug);
    chips.push({ slug: genre.slug, subject: genre.subject });
    if (chips.length === MAX_GENRE_CHIPS) return chips;
  }
  if (chips.length > 0) return chips;

  const rawChips: GenreChip[] = [];
  const seenText = new Set<string>();
  for (const subject of raw) {
    const text = subject.trim();
    if (!usableRawSubject(text) || seenText.has(norm(text))) continue;
    seenText.add(norm(text));
    rawChips.push({ slug: null, subject: text });
    if (rawChips.length === MAX_RAW_CHIPS) break;
  }
  return rawChips;
}
