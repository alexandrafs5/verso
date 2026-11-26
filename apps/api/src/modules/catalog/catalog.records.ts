import { GENRES, type GenreSlug, mapWorkGenres } from '@verso/shared';
import type {
  ExternalAuthor,
  ExternalEdition,
  ExternalWork,
} from '../../infra/catalog/catalog-provider.js';
import { genreSubjects } from './catalog.mappers.js';
import { plainDescription } from './domain/description-text.js';

/** What gets saved the first time a user adds a book (SPEC 20). Ids are added by the repository. */
export type AuthorRecord = {
  olAuthorKey: string;
  name: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
  photoUrl: string | null;
};

export type GenreRecord = { slug: GenreSlug; name: string };

export type WorkRecord = {
  olWorkKey: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  firstPublishYear: number | null;
  /** In the order of the work. */
  authors: AuthorRecord[];
  genres: GenreRecord[];
};

export type EditionRecord = Pick<
  ExternalEdition,
  | 'olEditionKey'
  | 'isbn10'
  | 'isbn13'
  | 'title'
  | 'publisher'
  | 'publishYear'
  | 'language'
  | 'pageCount'
  | 'format'
  | 'coverUrl'
>;

export function toWorkRecord(
  olWorkKey: string,
  work: ExternalWork,
  authors: ExternalAuthor[],
): WorkRecord {
  // The same subjects the work page shows, so the saved genres match its chips.
  const slugs = new Set(mapWorkGenres(genreSubjects(work)).map((chip) => chip.slug));
  return {
    olWorkKey,
    title: work.title,
    subtitle: work.subtitle,
    description: plainDescription(work.description),
    firstPublishYear: work.firstPublishYear,
    authors: authors.map((author) => ({
      olAuthorKey: author.olAuthorKey,
      name: author.name,
      bio: plainDescription(author.bio),
      birthYear: author.birthYear,
      deathYear: author.deathYear,
      photoUrl: author.photoUrl,
    })),
    genres: GENRES.filter((genre) => slugs.has(genre.slug)).map(({ slug, name }) => ({
      slug,
      name,
    })),
  };
}

export function toEditionRecord(edition: ExternalEdition): EditionRecord {
  return {
    olEditionKey: edition.olEditionKey,
    isbn10: edition.isbn10,
    isbn13: edition.isbn13,
    title: edition.title,
    publisher: edition.publisher,
    publishYear: edition.publishYear,
    language: edition.language,
    pageCount: edition.pageCount,
    format: edition.format,
    coverUrl: edition.coverUrl,
  };
}
