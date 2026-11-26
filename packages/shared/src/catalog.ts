import { z } from 'zod';
import { libraryStatusSchema } from './library';
import { authorRefSchema, editionRefSchema, UUID_RE, workRefSchema } from './refs';

export const EDITION_FORMATS = ['PAPERBACK', 'HARDCOVER', 'EBOOK', 'OTHER'] as const;
export const WORK_SOURCES = ['OPEN_LIBRARY', 'MANUAL'] as const;

export const SEARCH_QUERY_MAX = 200;
export const GENRE_MAX = 80;

const MAX_OL_SERIES_ID = 3 + 120;

/** A UUID (local series) or `ol:<name>` (derived from Open Library subjects, SPEC 18). */
export const seriesIdSchema = z
  .string()
  .refine(
    (v) =>
      UUID_RE.test(v) ||
      (v.startsWith('ol:') &&
        v.slice(3).trim() !== '' &&
        v.length <= MAX_OL_SERIES_ID &&
        ![...v].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)),
    { message: 'Invalid series id' },
  );

export const editionFormatSchema = z.enum(EDITION_FORMATS);
export const workSourceSchema = z.enum(WORK_SOURCES);

/** `q` is optional when `genre` is set (genre-only search, SPEC 18). At least one is required. */
export const searchBooksQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(SEARCH_QUERY_MAX).optional(),
    genre: z.string().trim().min(1).max(GENRE_MAX).optional(),
    cursor: z.string().min(1).max(200).optional(),
  })
  .refine((v) => v.q !== undefined || v.genre !== undefined, {
    message: 'q or genre is required',
  });

export const editionsQuerySchema = z.object({
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2}$/)
    .optional(),
});

export const authorLinkSchema = z.object({
  ref: authorRefSchema,
  name: z.string(),
});

export const workSummarySchema = z.object({
  ref: workRefSchema,
  title: z.string(),
  authors: z.array(authorLinkSchema),
  firstPublishYear: z.number().int().nullable(),
  coverUrl: z.string().nullable(),
  editionCount: z.number().int().nullable(),
  libraryStatus: libraryStatusSchema.nullable(),
});

export const workSeriesSchema = z.object({
  id: z.string(),
  name: z.string(),
  position: z.number().nullable(),
});

export const workDetailSchema = z.object({
  ref: workRefSchema,
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  firstPublishYear: z.number().int().nullable(),
  coverUrl: z.string().nullable(),
  authors: z.array(authorLinkSchema),
  genres: z.array(z.string()).max(30),
  series: workSeriesSchema.nullable(),
  source: workSourceSchema,
  libraryStatus: libraryStatusSchema.nullable(),
});

export const editionDtoSchema = z.object({
  ref: editionRefSchema,
  title: z.string(),
  isbn10: z.string().nullable(),
  isbn13: z.string().nullable(),
  publisher: z.string().nullable(),
  publishYear: z.number().int().nullable(),
  language: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  format: editionFormatSchema,
  coverUrl: z.string().nullable(),
  /** True when `language` is the original language of the work (SPEC 18). */
  isOriginalLanguage: z.boolean(),
  /** Plain-text blurb of this edition, in its own language. Lets the page show a description
   * in the reader's language, which Open Library has for some editions (SPEC 18). */
  description: z.string().nullable(),
});

export const authorDetailSchema = z.object({
  ref: authorRefSchema,
  name: z.string(),
  bio: z.string().nullable(),
  birthYear: z.number().int().nullable(),
  deathYear: z.number().int().nullable(),
  photoUrl: z.string().nullable(),
  works: z.array(workSummarySchema),
});

export const seriesDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  works: z.array(workSummarySchema.extend({ position: z.number().nullable() })),
});

export const isbnResultSchema = z.object({
  workRef: workRefSchema,
  edition: editionDtoSchema,
});

export const searchBooksResponseSchema = z.object({
  items: z.array(workSummarySchema),
  /** Folded 1-edition tail of this page (SPEC 17). */
  moreMatches: z.array(workSummarySchema),
  nextCursor: z.string().nullable(),
});

export type WorkRef = z.infer<typeof workRefSchema>;
export type AuthorRef = z.infer<typeof authorRefSchema>;
export type SearchBooksQuery = z.infer<typeof searchBooksQuerySchema>;
export type EditionsQuery = z.infer<typeof editionsQuerySchema>;
export type AuthorLink = z.infer<typeof authorLinkSchema>;
export type WorkSummary = z.infer<typeof workSummarySchema>;
export type WorkDetail = z.infer<typeof workDetailSchema>;
export type EditionDto = z.infer<typeof editionDtoSchema>;
export type AuthorDetail = z.infer<typeof authorDetailSchema>;
export type SeriesDetail = z.infer<typeof seriesDetailSchema>;
export type IsbnResult = z.infer<typeof isbnResultSchema>;
export type SearchBooksResponse = z.infer<typeof searchBooksResponseSchema>;
