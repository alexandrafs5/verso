export type EditionFormat = 'PAPERBACK' | 'HARDCOVER' | 'EBOOK' | 'OTHER';

export type WorkSearchResult = {
  /** Bare Open Library key, for example "OL1731119W". */
  olWorkKey: string;
  title: string;
  authors: { olAuthorKey: string; name: string }[];
  firstPublishYear: number | null;
  coverUrl: string | null;
  editionCount: number;
  /** ISO 639-1 codes. Open Library codes without a known mapping are dropped. */
  languages: string[];
};

export type ExternalWork = {
  olWorkKey: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  firstPublishYear: number | null;
  coverUrl: string | null;
  /** Names are resolved with getAuthor. */
  authorKeys: string[];
  /** Raw Open Library subjects. */
  subjects: string[];
};

export type ExternalEdition = {
  olEditionKey: string;
  olWorkKey: string | null;
  title: string;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  publishYear: number | null;
  /** ISO 639-1. */
  language: string | null;
  pageCount: number | null;
  format: EditionFormat;
  coverUrl: string | null;
};

export type ExternalAuthor = {
  olAuthorKey: string;
  name: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
  photoUrl: string | null;
};

/** `sort: 'editions'` ranks results by edition count, descending (SPEC 17). */
export type SearchOptions = { sort?: 'editions' };

/** Source of book metadata. Services depend on this interface, never on Open Library directly. */
export interface CatalogProvider {
  /**
   * One page of at most 20 results. Open Library docs that are not works are skipped, so a page can
   * have fewer than 20 results and still not be the last one. An empty page means no more results.
   */
  searchWorks(query: string, page: number, opts?: SearchOptions): Promise<WorkSearchResult[]>;
  getWork(olWorkKey: string): Promise<ExternalWork>;
  listEditions(olWorkKey: string, opts: { language?: string }): Promise<ExternalEdition[]>;
  getEditionByIsbn(isbn: string): Promise<ExternalEdition | null>;
  getAuthor(olAuthorKey: string): Promise<ExternalAuthor>;
}

export const CATALOG_PROVIDER = Symbol('CATALOG_PROVIDER');

export const SEARCH_PAGE_SIZE = 20;
