import type { AuthorLink, EditionDto, WorkDetail, WorkSummary } from '@verso/shared';
import type {
  ExternalEdition,
  ExternalWork,
  WorkSearchResult,
} from '../../infra/catalog/catalog-provider.js';
import type { Edition } from '../../generated/prisma/client.js';
import type { WorkRow, WorkSummaryRow } from './catalog.repository.js';
import { olRef } from './domain/catalog-ref.js';

export const MAX_GENRES = 8;
export const MAX_AUTHORS = 5;

const asNumber = (value: { toString(): string } | null): number | null =>
  value === null ? null : Number(value.toString());

export function searchResultToSummary(result: WorkSearchResult): WorkSummary {
  return {
    ref: olRef(result.olWorkKey),
    title: result.title,
    authors: result.authors.map((a) => ({ ref: olRef(a.olAuthorKey), name: a.name })),
    firstPublishYear: result.firstPublishYear,
    coverUrl: result.coverUrl,
    editionCount: result.editionCount,
    libraryStatus: null,
  };
}

const localAuthors = (row: WorkSummaryRow): AuthorLink[] =>
  row.authors.map((link) => ({ ref: link.author.id, name: link.author.name }));

export function localWorkToSummary(row: WorkSummaryRow): WorkSummary {
  return {
    ref: row.id,
    title: row.title,
    authors: localAuthors(row),
    firstPublishYear: row.firstPublishYear,
    // Covers belong to editions; a work without a persisted edition has none.
    coverUrl: null,
    editionCount: null,
    libraryStatus: null,
  };
}

export function localWorkToDetail(row: WorkRow): WorkDetail {
  return {
    ref: row.id,
    title: row.title,
    subtitle: row.subtitle,
    description: row.description,
    firstPublishYear: row.firstPublishYear,
    coverUrl: null,
    authors: localAuthors(row),
    genres: row.genres.map((g) => g.genre.name).slice(0, MAX_GENRES),
    series: row.series
      ? { id: row.series.id, name: row.series.name, position: asNumber(row.seriesPosition) }
      : null,
    source: row.source,
    libraryStatus: null,
  };
}

export function externalWorkToDetail(work: ExternalWork, authors: AuthorLink[]): WorkDetail {
  return {
    ref: olRef(work.olWorkKey),
    title: work.title,
    subtitle: work.subtitle,
    description: work.description,
    firstPublishYear: work.firstPublishYear,
    coverUrl: work.coverUrl,
    authors,
    genres: work.subjects.slice(0, MAX_GENRES),
    series: null,
    source: 'OPEN_LIBRARY',
    libraryStatus: null,
  };
}

export function localEditionToDto(edition: Edition): EditionDto {
  return {
    ref: edition.id,
    title: edition.title,
    isbn10: edition.isbn10,
    isbn13: edition.isbn13,
    publisher: edition.publisher,
    publishYear: edition.publishYear,
    language: edition.language,
    pageCount: edition.pageCount,
    format: edition.format,
    coverUrl: edition.coverUrl,
  };
}

export function externalEditionToDto(edition: ExternalEdition): EditionDto {
  return {
    ref: olRef(edition.olEditionKey),
    title: edition.title,
    isbn10: edition.isbn10,
    isbn13: edition.isbn13,
    publisher: edition.publisher,
    publishYear: edition.publishYear,
    language: edition.language,
    pageCount: edition.pageCount,
    format: edition.format,
    coverUrl: edition.coverUrl,
  };
}

/** Ascending by first publication year, unknown years last. Stable. */
export function sortByYear<T extends { firstPublishYear: number | null }>(works: T[]): T[] {
  return [...works].sort((a, b) => {
    if (a.firstPublishYear === b.firstPublishYear) return 0;
    if (a.firstPublishYear === null) return 1;
    if (b.firstPublishYear === null) return -1;
    return a.firstPublishYear - b.firstPublishYear;
  });
}

export const decimalToNumber = asNumber;
