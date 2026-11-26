import type { AuthorLink, EditionDto, WorkDetail, WorkSummary } from '@verso/shared';
import type {
  ExternalEdition,
  ExternalWork,
  WorkSearchResult,
} from '../../infra/catalog/catalog-provider.js';
import type { Edition } from '../../generated/prisma/client.js';
import type { WorkRow, WorkSummaryRow } from './catalog.repository.js';
import { olRef } from './domain/catalog-ref.js';
import { plainDescription } from './domain/description-text.js';
import { isSeriesSubject, seriesFromSubjects } from './domain/ol-series.js';

/** Subjects kept per work. The web maps them to at most 5 chips (SPEC 18). */
export const MAX_GENRES = 30;
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

/**
 * Open Library data on top of a saved work (SPEC 20). A local row has no cover, no derived series
 * and only mapped genres, so those come from the provider when it answers (`external` is null when
 * it does not), with the local value as the fallback. Everything else stays local.
 */
export function overlayProviderWork(
  local: WorkDetail,
  external: ExternalWork | null,
  savedCoverUrl: string | null,
): WorkDetail {
  const subjects = external ? genreSubjects(external) : [];
  return {
    ...local,
    coverUrl: external?.coverUrl ?? savedCoverUrl,
    genres: subjects.length > 0 ? subjects : local.genres,
    series: (external ? seriesFromSubjects(external.subjects) : null) ?? local.series,
  };
}

/** `series:` subjects feed the series line, not the genre chips. */
const genreSubjects = (work: ExternalWork): string[] =>
  work.subjects.filter((subject) => !isSeriesSubject(subject)).slice(0, MAX_GENRES);

export function externalWorkToDetail(work: ExternalWork, authors: AuthorLink[]): WorkDetail {
  return {
    ref: olRef(work.olWorkKey),
    title: work.title,
    subtitle: work.subtitle,
    // Open Library descriptions carry Markdown; the cache stores them raw, so clean on the way out.
    description: plainDescription(work.description),
    firstPublishYear: work.firstPublishYear,
    coverUrl: work.coverUrl,
    authors,
    genres: genreSubjects(work),
    series: seriesFromSubjects(work.subjects),
    source: 'OPEN_LIBRARY',
    libraryStatus: null,
  };
}

/** `original` is the original language of the whole list (`originalLanguage`), or null. */
export function localEditionToDto(edition: Edition, original: string | null): EditionDto {
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
    isOriginalLanguage: original !== null && edition.language === original,
    description: null,
  };
}

export function externalEditionToDto(
  edition: ExternalEdition,
  original: string | null,
): EditionDto {
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
    isOriginalLanguage: original !== null && edition.language === original,
    // Open Library blurbs carry Markdown; the cache stores them raw, so clean on the way out.
    description: plainDescription(edition.description),
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
