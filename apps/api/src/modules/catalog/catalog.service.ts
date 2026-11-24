import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  type AuthorDetail,
  type AuthorLink,
  type EditionDto,
  ErrorCode,
  type IsbnResult,
  type SearchBooksQuery,
  type SearchBooksResponse,
  type SeriesDetail,
  type WorkDetail,
} from '@verso/shared';
import { ApiException } from '../../common/api-exception.js';
import {
  CatalogNotFoundError,
  CatalogUnavailableError,
} from '../../infra/catalog/catalog-errors.js';
import { CATALOG_PROVIDER, type CatalogProvider } from '../../infra/catalog/catalog-provider.js';
import type { Author } from '../../generated/prisma/client.js';
import { CatalogRepository, type WorkRow } from './catalog.repository.js';
import {
  decimalToNumber,
  externalEditionToDto,
  externalWorkToDetail,
  localEditionToDto,
  localWorkToDetail,
  localWorkToSummary,
  MAX_AUTHORS,
  searchResultToSummary,
  sortByYear,
} from './catalog.mappers.js';
import {
  authorWorksQuery,
  buildSearchQuery,
  decodeCursor,
  encodeCursor,
  isUuid,
  olRef,
  parseIsbn,
  parseRef,
} from './domain/catalog-ref.js';
import { rankEditions } from './domain/edition-rank.js';
import { olSeriesName, seriesSearchQuery } from './domain/ol-series.js';
import { originalLanguage } from './domain/original-language.js';
import { collapseSearchResults } from './domain/search-collapse.js';

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
    const providerQuery = buildSearchQuery(query.q, query.genre);
    // A genre that is only quotes, with no q, leaves nothing to search for.
    if (providerQuery === '')
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR);
    const results = await mapCatalogErrors(() => this.provider.searchWorks(providerQuery, page));
    // Merging happens per provider page, so the cursor and the end-of-results signal (an empty
    // provider page, SPEC 13) are unchanged. The visible guard applies on the first page only.
    const { items, moreMatches } = collapseSearchResults(results, {
      guardVisible: query.cursor === undefined,
    });
    return {
      items: items.map(searchResultToSummary),
      moreMatches: moreMatches.map(searchResultToSummary),
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

  async getEditions(userId: string, ref: string, language?: string): Promise<EditionDto[]> {
    const parsed = parseRef(ref, 'W');
    if (!parsed) throw invalidRef();

    let olWorkKey: string;
    if (parsed.kind === 'ol') {
      olWorkKey = parsed.key;
    } else {
      const row = await this.repo.findWorkById(parsed.id);
      if (!row || !canView(row, userId)) throw notFound();
      if (!row.olWorkKey) {
        // The original language is derived from the full list, then the language filter applies.
        const editions = await this.repo.findEditionsByWork(row.id);
        const original = originalLanguage(editions);
        return editions
          .filter((edition) => !language || edition.language === language)
          .map((edition) => localEditionToDto(edition, original));
      }
      olWorkKey = row.olWorkKey;
    }
    // Always the full list (cached once), so the original language never depends on the filter.
    const editions = await mapCatalogErrors(() => this.provider.listEditions(olWorkKey, {}));
    const original = originalLanguage(editions);
    // Open Library has no popularity data: well-described editions go first (SPEC 18).
    return rankEditions(editions)
      .filter((edition) => !language || edition.language === language)
      .map((edition) => externalEditionToDto(edition, original));
  }

  async getAuthor(ref: string): Promise<AuthorDetail> {
    const parsed = parseRef(ref, 'A');
    if (!parsed) throw invalidRef();

    if (parsed.kind === 'local') {
      const row = await this.repo.findAuthorById(parsed.id);
      if (!row) throw notFound();
      return this.localAuthorDetail(row);
    }
    const local = await this.repo.findAuthorByOlKey(parsed.key);
    if (local) return this.localAuthorDetail(local);

    const [author, works] = await Promise.all([
      mapCatalogErrors(() => this.provider.getAuthor(parsed.key)),
      this.worksOfOlAuthor(parsed.key),
    ]);
    return {
      ref: olRef(author.olAuthorKey),
      name: author.name,
      bio: author.bio,
      birthYear: author.birthYear,
      deathYear: author.deathYear,
      photoUrl: author.photoUrl,
      works,
    };
  }

  private async localAuthorDetail(local: Author): Promise<AuthorDetail> {
    const works = local.olAuthorKey
      ? await this.worksOfOlAuthor(local.olAuthorKey)
      : (await this.repo.findPublicWorksByAuthor(local.id)).map(localWorkToSummary);
    return {
      ref: local.id,
      name: local.name,
      bio: local.bio,
      birthYear: local.birthYear,
      deathYear: local.deathYear,
      photoUrl: local.photoUrl,
      works,
    };
  }

  /** First page of Open Library works for an author, oldest first. */
  private async worksOfOlAuthor(olAuthorKey: string) {
    const results = await mapCatalogErrors(() =>
      this.provider.searchWorks(authorWorksQuery(olAuthorKey), 1),
    );
    return sortByYear(results.map(searchResultToSummary));
  }

  async getSeries(id: string): Promise<SeriesDetail> {
    const olName = olSeriesName(id);
    if (olName !== null) return this.getOpenLibrarySeries(id, olName);
    if (!isUuid(id)) throw invalidRef();
    const row = await this.repo.findSeriesById(id);
    if (!row) throw notFound();
    return {
      id: row.id,
      name: row.name,
      works: row.works.map((work) => ({
        ...localWorkToSummary(work),
        position: decimalToNumber(work.seriesPosition),
      })),
    };
  }

  /**
   * A series derived from Open Library subjects (SPEC 18). The works come from a subject search,
   * first page only, with duplicates merged and the 1-edition tail dropped. Open Library has no
   * series positions, so every position is null.
   */
  private async getOpenLibrarySeries(id: string, name: string): Promise<SeriesDetail> {
    const results = await mapCatalogErrors(() =>
      this.provider.searchWorks(seriesSearchQuery(name), 1),
    );
    const { items } = collapseSearchResults(results, { guardVisible: true });
    if (items.length === 0) throw notFound();
    return {
      id,
      name,
      works: items.map((result) => ({ ...searchResultToSummary(result), position: null })),
    };
  }

  async lookupIsbn(isbn: string): Promise<IsbnResult> {
    const normalized = parseIsbn(isbn);
    if (!normalized) throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.INVALID_ISBN);

    const edition = await mapCatalogErrors(() => this.provider.getEditionByIsbn(normalized));
    if (!edition?.olWorkKey) throw notFound();

    const local = await this.repo.findWorkByOlKey(edition.olWorkKey);
    return {
      workRef: local ? local.id : olRef(edition.olWorkKey),
      edition: externalEditionToDto(edition, null),
    };
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
