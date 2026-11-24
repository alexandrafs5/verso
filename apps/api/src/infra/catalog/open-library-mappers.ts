import { z } from 'zod';
import type {
  EditionFormat,
  ExternalAuthor,
  ExternalEdition,
  ExternalWork,
  WorkSearchResult,
} from './catalog-provider.js';

// Open Library response shapes. Only the fields we read are declared; the rest is dropped.

const textSchema = z.union([z.string(), z.object({ value: z.string() })]);

export const searchResponseSchema = z.object({
  docs: z.array(z.unknown()),
});

const searchDocSchema = z.object({
  key: z.string(),
  title: z.string(),
  author_name: z.array(z.string()).optional(),
  author_key: z.array(z.string()).optional(),
  first_publish_year: z.number().optional(),
  cover_i: z.number().optional(),
  edition_count: z.number().optional(),
  language: z.array(z.string()).optional(),
});

export const workSchema = z.object({
  key: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  description: textSchema.optional(),
  first_publish_date: z.string().optional(),
  covers: z.array(z.number()).optional(),
  authors: z.array(z.object({ author: z.object({ key: z.string() }).optional() })).optional(),
  subjects: z.array(z.string()).optional(),
});

export const editionsResponseSchema = z.object({
  entries: z.array(z.unknown()),
});

export const editionSchema = z.object({
  key: z.string(),
  works: z.array(z.object({ key: z.string() })).optional(),
  title: z.string(),
  publishers: z.array(z.string()).optional(),
  publish_date: z.string().optional(),
  isbn_10: z.array(z.string()).optional(),
  isbn_13: z.array(z.string()).optional(),
  languages: z.array(z.object({ key: z.string() })).optional(),
  number_of_pages: z.number().optional(),
  physical_format: z.string().optional(),
  covers: z.array(z.number()).optional(),
});

export const authorSchema = z.object({
  key: z.string(),
  name: z.string(),
  bio: textSchema.optional(),
  birth_date: z.string().optional(),
  death_date: z.string().optional(),
  photos: z.array(z.number()).optional(),
});

export type OpenLibrarySearchDoc = z.infer<typeof searchDocSchema>;
export type OpenLibraryWork = z.infer<typeof workSchema>;
export type OpenLibraryEdition = z.infer<typeof editionSchema>;
export type OpenLibraryAuthor = z.infer<typeof authorSchema>;

// Keys

const WORK_KEY = /^OL\d+W$/;
const AUTHOR_KEY = /^OL\d+A$/;

/** "/works/OL1W" or "OL1W" becomes "OL1W". */
export function bareKey(key: string): string {
  const last = key.split('/').filter(Boolean).pop();
  return last ?? '';
}

export const isWorkKey = (key: string): boolean => WORK_KEY.test(key);
export const isAuthorKey = (key: string): boolean => AUTHOR_KEY.test(key);

/** Removes spaces and hyphens. Returns null unless the result is an ISBN-10 or ISBN-13. */
export function normalizeIsbn(input: string): string | null {
  const value = input.replace(/[\s-]/g, '').toUpperCase();
  return /^\d{9}[\dX]$/.test(value) || /^\d{13}$/.test(value) ? value : null;
}

// Values

const COVERS_BASE = 'https://covers.openlibrary.org';

/** Cover-ID URL. Open Library uses -1 or missing ids for "no cover". */
export function coverUrl(id: number | undefined, kind: 'b' | 'a' = 'b', size = 'M'): string | null {
  return id !== undefined && Number.isInteger(id) && id > 0
    ? `${COVERS_BASE}/${kind}/id/${id}-${size}.jpg`
    : null;
}

const firstCoverId = (ids: number[] | undefined): number | undefined =>
  ids?.find((id) => Number.isInteger(id) && id > 0);

/** First four-digit year in free text such as "Feb 01, 1984" or "1959-01-01". */
export function parseYear(value: string | undefined): number | null {
  const match = value ? /(?<!\d)(\d{4})(?!\d)/.exec(value) : null;
  return match?.[1] ? Number(match[1]) : null;
}

/** Description and bio are either a string or `{ type, value }`. */
export function textValue(value: z.infer<typeof textSchema> | undefined): string | null {
  const text = typeof value === 'string' ? value : value?.value;
  const trimmed = text?.trim();
  return trimmed ? trimmed : null;
}

/** Open Library ISO 639-2 codes to ISO 639-1. Unknown codes map to null. */
const LANGUAGES: Record<string, string> = {
  ara: 'ar',
  cat: 'ca',
  ces: 'cs',
  cze: 'cs',
  chi: 'zh',
  zho: 'zh',
  dan: 'da',
  deu: 'de',
  ger: 'de',
  dut: 'nl',
  nld: 'nl',
  ell: 'el',
  gre: 'el',
  eng: 'en',
  eus: 'eu',
  baq: 'eu',
  fin: 'fi',
  fra: 'fr',
  fre: 'fr',
  gle: 'ga',
  glg: 'gl',
  heb: 'he',
  hin: 'hi',
  ita: 'it',
  jpn: 'ja',
  kor: 'ko',
  lat: 'la',
  nor: 'no',
  pol: 'pl',
  por: 'pt',
  rus: 'ru',
  spa: 'es',
  swe: 'sv',
  tur: 'tr',
};

/** "/languages/spa" or "spa" becomes "es". */
export function mapLanguage(key: string): string | null {
  return LANGUAGES[bareKey(key)] ?? null;
}

export function mapFormat(physicalFormat: string | undefined): EditionFormat {
  const value = physicalFormat?.toLowerCase() ?? '';
  if (/hard/.test(value)) return 'HARDCOVER';
  if (/paperback|softcover|soft cover|mass market|trade paper/.test(value)) return 'PAPERBACK';
  if (/ebook|e-book|kindle|electronic|epub|digital/.test(value)) return 'EBOOK';
  return 'OTHER';
}

const nonEmpty = (value: string | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

// Mappers

/** Returns null when the document is not a work (for example an author or a malformed key). */
export function mapSearchDoc(raw: unknown): WorkSearchResult | null {
  const parsed = searchDocSchema.safeParse(raw);
  if (!parsed.success) return null;
  const doc = parsed.data;
  const olWorkKey = bareKey(doc.key);
  if (!isWorkKey(olWorkKey)) return null;

  const names = doc.author_name ?? [];
  const authors = (doc.author_key ?? []).flatMap((key, index) => {
    const name = names[index];
    return name ? [{ olAuthorKey: bareKey(key), name }] : [];
  });
  const languages = [...new Set((doc.language ?? []).flatMap((code) => mapLanguage(code) ?? []))];

  return {
    olWorkKey,
    title: doc.title,
    authors,
    firstPublishYear: doc.first_publish_year ?? null,
    coverUrl: coverUrl(doc.cover_i),
    editionCount: doc.edition_count ?? 0,
    languages,
  };
}

export function mapWork(work: OpenLibraryWork): ExternalWork {
  const authorKeys = (work.authors ?? []).flatMap((entry) =>
    entry.author ? [bareKey(entry.author.key)] : [],
  );
  return {
    olWorkKey: bareKey(work.key),
    title: work.title,
    subtitle: nonEmpty(work.subtitle),
    description: textValue(work.description),
    firstPublishYear: parseYear(work.first_publish_date),
    coverUrl: coverUrl(firstCoverId(work.covers)),
    authorKeys,
    subjects: work.subjects ?? [],
  };
}

/** Returns null when the entry does not have the fields we need. */
export function mapEdition(raw: unknown): ExternalEdition | null {
  const parsed = editionSchema.safeParse(raw);
  if (!parsed.success) return null;
  const edition = parsed.data;
  const workKey = edition.works?.[0] ? bareKey(edition.works[0].key) : null;
  const languageKey = edition.languages?.[0]?.key;

  return {
    olEditionKey: bareKey(edition.key),
    olWorkKey: workKey && isWorkKey(workKey) ? workKey : null,
    title: edition.title,
    isbn10: nonEmpty(edition.isbn_10?.[0]?.replace(/[\s-]/g, '')),
    isbn13: nonEmpty(edition.isbn_13?.[0]?.replace(/[\s-]/g, '')),
    publisher: nonEmpty(edition.publishers?.[0]),
    publishYear: parseYear(edition.publish_date),
    language: languageKey ? mapLanguage(languageKey) : null,
    pageCount:
      edition.number_of_pages !== undefined && edition.number_of_pages > 0
        ? edition.number_of_pages
        : null,
    format: mapFormat(edition.physical_format),
    coverUrl: coverUrl(firstCoverId(edition.covers)),
  };
}

export function mapAuthor(author: OpenLibraryAuthor): ExternalAuthor {
  return {
    olAuthorKey: bareKey(author.key),
    name: author.name,
    bio: textValue(author.bio),
    birthYear: parseYear(author.birth_date),
    deathYear: parseYear(author.death_date),
    photoUrl: coverUrl(firstCoverId(author.photos), 'a'),
  };
}
