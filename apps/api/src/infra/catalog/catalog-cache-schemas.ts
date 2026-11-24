import { z } from 'zod';
import type {
  ExternalAuthor,
  ExternalEdition,
  ExternalWork,
  WorkSearchResult,
} from './catalog-provider.js';

// Schemas for payloads stored in ExternalCache. A cached value that no longer matches is a miss.

export const workSearchResultSchema: z.ZodType<WorkSearchResult> = z.object({
  olWorkKey: z.string(),
  title: z.string(),
  authors: z.array(z.object({ olAuthorKey: z.string(), name: z.string() })),
  firstPublishYear: z.number().nullable(),
  coverUrl: z.string().nullable(),
  editionCount: z.number(),
  languages: z.array(z.string()),
  // Rows cached before SPEC 18 lack this field.
  typicalYear: z.number().nullable().optional(),
});

export const externalWorkSchema: z.ZodType<ExternalWork> = z.object({
  olWorkKey: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  firstPublishYear: z.number().nullable(),
  coverUrl: z.string().nullable(),
  authorKeys: z.array(z.string()),
  subjects: z.array(z.string()),
});

export const externalEditionSchema: z.ZodType<ExternalEdition> = z.object({
  olEditionKey: z.string(),
  olWorkKey: z.string().nullable(),
  title: z.string(),
  isbn10: z.string().nullable(),
  isbn13: z.string().nullable(),
  publisher: z.string().nullable(),
  publishYear: z.number().nullable(),
  language: z.string().nullable(),
  pageCount: z.number().nullable(),
  format: z.enum(['PAPERBACK', 'HARDCOVER', 'EBOOK', 'OTHER']),
  coverUrl: z.string().nullable(),
  // Rows cached before SPEC 18 lack this field.
  translatedFrom: z.string().nullable().default(null),
});

export const externalAuthorSchema: z.ZodType<ExternalAuthor> = z.object({
  olAuthorKey: z.string(),
  name: z.string(),
  bio: z.string().nullable(),
  birthYear: z.number().nullable(),
  deathYear: z.number().nullable(),
  photoUrl: z.string().nullable(),
});
