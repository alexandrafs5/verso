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
  /**
   * A release year that ignores one stray early date (Open Library often dates a first edition
   * years too early). Used to order works. Absent or null when Open Library gives no years.
   */
  typicalYear?: number | null;
};

export type SearchOptions = {
  /** `editions` lists the works with the most editions first. Default is relevance. */
  sort?: 'editions';
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
  /** ISO 639-1 of the language this edition was translated from, when Open Library says so. */
  translatedFrom: string | null;
};

export type ExternalAuthor = {
  olAuthorKey: string;
  name: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
  photoUrl: string | null;
};

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
