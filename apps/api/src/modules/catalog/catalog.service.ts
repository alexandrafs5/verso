import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type AuthorLink,
  ErrorCode,
  type SearchBooksQuery,
  type SearchBooksResponse,
  type WorkDetail,
} from '@verso/shared';
import { ApiException } from '../../common/api-exception.js';
import {
  CatalogNotFoundError,
  CatalogUnavailableError,
} from '../../infra/catalog/catalog-errors.js';
import { CATALOG_PROVIDER, type CatalogProvider } from '../../infra/catalog/catalog-provider.js';
import { CatalogRepository, type WorkRow } from './catalog.repository.js';
import {
  externalWorkToDetail,
  localWorkToDetail,
  MAX_AUTHORS,
  searchResultToSummary,
} from './catalog.mappers.js';
import {
  buildSearchQuery,
  decodeCursor,
  encodeCursor,
  olRef,
  parseRef,
} from './domain/catalog-ref.js';

const notFound = () => new ApiException(HttpStatus.NOT_FOUND, ErrorCode.CATALOG_NOT_FOUND);
const invalidRef = () => new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_REF);

/** Runs a provider call and turns its typed errors into problem+json errors. */
export async function mapCatalogErrors<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (error instanceof CatalogNotFoundError) throw notFound();
    if (error instanceof CatalogUnavailableError) {
      throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, ErrorCode.CATALOG_UNAVAILABLE);
    }
    throw error;
  }
}

/** A private (manual) work is visible only to the user who created it. */
const canView = (work: Pick<WorkRow, 'catalogStatus' | 'createdById'>, userId: string): boolean =>
  work.catalogStatus === 'PUBLIC' || work.createdById === userId;

@Injectable()
export class CatalogService {
  constructor(
    @Inject(CatalogRepository) private readonly repo: CatalogRepository,
    @Inject(CATALOG_PROVIDER) private readonly provider: CatalogProvider,
  ) {}

  async searchBooks(query: SearchBooksQuery): Promise<SearchBooksResponse> {
    let page = 1;
    if (query.cursor !== undefined) {
      const decoded = decodeCursor(query.cursor);
      if (decoded === null)
        throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_CURSOR);
      page = decoded;
    }
    const results = await mapCatalogErrors(() =>
      this.provider.searchWorks(buildSearchQuery(query.q, query.genre), page),
    );
    // An empty page is the provider's end-of-results signal (SPEC 13).
    return {
      items: results.map(searchResultToSummary),
      nextCursor: results.length > 0 ? encodeCursor(page + 1) : null,
    };
  }

  async getWork(userId: string, ref: string): Promise<WorkDetail> {
    const parsed = parseRef(ref, 'W');
    if (!parsed) throw invalidRef();

    if (parsed.kind === 'local') {
      const row = await this.repo.findWorkById(parsed.id);
      if (!row || !canView(row, userId)) throw notFound();
      return localWorkToDetail(row);
    }

    // A work persisted earlier wins over Open Library, and the web gets its local id.
    const local = await this.repo.findWorkByOlKey(parsed.key);
    if (local && canView(local, userId)) return localWorkToDetail(local);

    const work = await mapCatalogErrors(() => this.provider.getWork(parsed.key));
    const authors = await this.resolveAuthors(work.authorKeys);
    return externalWorkToDetail(work, authors);
  }

  /** At most MAX_AUTHORS. An author Open Library no longer knows is dropped; an outage fails. */
  private async resolveAuthors(authorKeys: string[]): Promise<AuthorLink[]> {
    const found = await Promise.all(
      authorKeys.slice(0, MAX_AUTHORS).map(async (key) => {
        try {
          const author = await mapCatalogErrors(() => this.provider.getAuthor(key));
          return { ref: olRef(author.olAuthorKey), name: author.name };
        } catch (error) {
          if (error instanceof ApiException && error.code === ErrorCode.CATALOG_NOT_FOUND) {
            return null;
          }
          throw error;
        }
      }),
    );
    return found.filter((author): author is AuthorLink => author !== null);
  }
}
