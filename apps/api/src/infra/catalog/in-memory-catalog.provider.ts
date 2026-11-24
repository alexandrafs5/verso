import { CatalogNotFoundError, CatalogUnavailableError } from './catalog-errors.js';
import {
  type CatalogProvider,
  type ExternalAuthor,
  type ExternalEdition,
  type ExternalWork,
  SEARCH_PAGE_SIZE,
  type WorkSearchResult,
} from './catalog-provider.js';
import { normalizeIsbn } from './open-library-mappers.js';

/** Seedable fake of CatalogProvider for tests. Never touches the network. */
export class InMemoryCatalogProvider implements CatalogProvider {
  /** When true, every call throws CatalogUnavailableError, like an Open Library outage. */
  unavailable = false;

  private readonly searchable: WorkSearchResult[] = [];
  private readonly seriesWorks = new Map<string, WorkSearchResult[]>();
  private readonly works = new Map<string, ExternalWork>();
  private readonly editions: ExternalEdition[] = [];
  private readonly authors = new Map<string, ExternalAuthor>();

  addSearchResult(result: WorkSearchResult): this {
    this.searchable.push(result);
    return this;
  }

  /** Seeds the answer to the subject search `subject:"series:<name>"` (case-insensitive). */
  addSeries(name: string, results: WorkSearchResult[]): this {
    this.seriesWorks.set(name.trim().toLowerCase(), results);
    return this;
  }

  addWork(work: ExternalWork): this {
    this.works.set(work.olWorkKey, work);
    return this;
  }

  addEdition(edition: ExternalEdition): this {
    this.editions.push(edition);
    return this;
  }

  addAuthor(author: ExternalAuthor): this {
    this.authors.set(author.olAuthorKey, author);
    return this;
  }

  searchWorks(query: string, page: number): Promise<WorkSearchResult[]> {
    return this.run(() => {
      const needle = query.trim().toLowerCase();
      if (!needle) return [];
      const series = /^subject:"series:(.+)"$/.exec(needle)?.[1];
      if (series !== undefined)
        return page === 1 ? (this.seriesWorks.get(series.trim()) ?? []) : [];
      const matches = this.searchable.filter(
        (result) =>
          result.title.toLowerCase().includes(needle) ||
          result.authors.some((author) => author.name.toLowerCase().includes(needle)),
      );
      const pageNumber = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
      const start = (pageNumber - 1) * SEARCH_PAGE_SIZE;
      return matches.slice(start, start + SEARCH_PAGE_SIZE);
    });
  }

  getWork(olWorkKey: string): Promise<ExternalWork> {
    return this.run(() => {
      const work = this.works.get(olWorkKey);
      if (!work) throw new CatalogNotFoundError();
      return work;
    });
  }

  listEditions(olWorkKey: string, opts: { language?: string }): Promise<ExternalEdition[]> {
    return this.run(() => {
      if (!this.works.has(olWorkKey)) throw new CatalogNotFoundError();
      const language = opts.language?.trim().toLowerCase() || undefined;
      return this.editions.filter(
        (edition) =>
          edition.olWorkKey === olWorkKey && (!language || edition.language === language),
      );
    });
  }

  getEditionByIsbn(isbn: string): Promise<ExternalEdition | null> {
    return this.run(() => {
      const normalized = normalizeIsbn(isbn);
      if (!normalized) return null;
      return (
        this.editions.find(
          (edition) => edition.isbn13 === normalized || edition.isbn10 === normalized,
        ) ?? null
      );
    });
  }

  getAuthor(olAuthorKey: string): Promise<ExternalAuthor> {
    return this.run(() => {
      const author = this.authors.get(olAuthorKey);
      if (!author) throw new CatalogNotFoundError();
      return author;
    });
  }

  private run<T>(action: () => T): Promise<T> {
    try {
      if (this.unavailable) throw new CatalogUnavailableError();
      return Promise.resolve(action());
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error(String(error)));
    }
  }
}
