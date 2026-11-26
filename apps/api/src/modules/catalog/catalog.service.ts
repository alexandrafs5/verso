import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import {
  type AuthorDetail,
  type AuthorLink,
  type EditionDto,
  ErrorCode,
  type IsbnResult,
  pickDefaultEdition,
  type SearchBooksQuery,
  type SearchBooksResponse,
  type SeriesDetail,
  type WorkDetail,
  type WorkSummary,
} from '@verso/shared';
import { ApiException } from '../../common/api-exception.js';
import { LibraryStatusService } from '../library/library-status.service.js';
import {
  CatalogNotFoundError,
  CatalogUnavailableError,
} from '../../infra/catalog/catalog-errors.js';
import {
  CATALOG_PROVIDER,
  type CatalogProvider,
  type ExternalAuthor,
  type ExternalEdition,
  type ExternalWork,
  type WorkSearchResult,
} from '../../infra/catalog/catalog-provider.js';
import type { Author } from '../../generated/prisma/client.js';
import { CatalogRepository, type WorkRow, type WorkSummaryRow } from './catalog.repository.js';
import {
  decimalToNumber,
  externalEditionToDto,
  externalWorkToDetail,
  localEditionToDto,
  localWorkToDetail,
  localWorkToSummary,
  MAX_AUTHORS,
  overlayProviderWork,
  searchResultToSummary,
} from './catalog.mappers.js';
import { toEditionRecord, toWorkRecord, type WorkRecord } from './catalog.records.js';
import {
  authorWorksQuery,
  buildSearchQuery,
  type CatalogRef,
  decodeCursor,
  encodeCursor,
  isUuid,
  olRef,
  parseIsbn,
  parseRef,
} from './domain/catalog-ref.js';
import { plainDescription } from './domain/description-text.js';
import { rankEditions } from './domain/edition-rank.js';
import { sortByReleaseYear } from './domain/release-order.js';
import {
  olSeriesName,
  seriesFieldQuery,
  seriesSearchQuery,
  seriesTitleQuery,
} from './domain/ol-series.js';
import { originalLanguage } from './domain/original-language.js';
import { type CollapsedWork, collapseSearchResults } from './domain/search-collapse.js';
import {
  isSeriesJunkTitle,
  mainAuthor,
  MIN_EDITIONS_FOR_TEXT_MATCH,
  selectSeriesWorks,
} from './domain/series-works.js';

/** Pages of 20 works read for an author page. */
const AUTHOR_WORK_PAGES = 3;

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

const editionNotInWork = () =>
  new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.EDITION_NOT_IN_WORK);
const noEdition = () =>
  new ApiException(HttpStatus.UNPROCESSABLE_ENTITY, ErrorCode.NO_EDITION_AVAILABLE);

/** A manual work is always saved; an Open Library work may not be yet (`workId` null). */
export type LibraryTarget =
  { olWorkKey: null; workId: string } | { olWorkKey: string; workId: string | null };

export type SavedBook = { workId: string; editionId: string; editionRef: string };

const savedBook = (
  workId: string,
  edition: { id: string; olEditionKey: string | null },
): SavedBook => ({
  workId,
  editionId: edition.id,
  editionRef: edition.olEditionKey ? olRef(edition.olEditionKey) : edition.id,
});

/** A private (manual) work is visible only to the user who created it. */
const canView = (work: Pick<WorkRow, 'catalogStatus' | 'createdById'>, userId: string): boolean =>
  work.catalogStatus === 'PUBLIC' || work.createdById === userId;

@Injectable()
export class CatalogService {
  private readonly logger = new Logger(CatalogService.name);

  constructor(
    @Inject(CatalogRepository) private readonly repo: CatalogRepository,
    @Inject(CATALOG_PROVIDER) private readonly provider: CatalogProvider,
    @Inject(LibraryStatusService) private readonly library: LibraryStatusService,
  ) {}

  async searchBooks(userId: string, query: SearchBooksQuery): Promise<SearchBooksResponse> {
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
    // A genre alone is an exact subject match, so the works with most editions come first.
    // With text the sort would put loosely matching popular books on top (SPEC 17).
    const sort = query.q === undefined ? ({ sort: 'editions' } as const) : undefined;
    const results = await mapCatalogErrors(() =>
      this.provider.searchWorks(providerQuery, page, sort),
    );
    // Merging happens per provider page, so the cursor and the end-of-results signal (an empty
    // provider page, SPEC 13) are unchanged. The visible guard applies on the first page only.
    const { items, moreMatches } = collapseSearchResults(results, {
      guardVisible: query.cursor === undefined,
    });
    // One lookup for both lists.
    const rows = await this.toLibraryRows(userId, [...items, ...moreMatches]);
    return {
      items: rows.slice(0, items.length),
      moreMatches: rows.slice(items.length),
      nextCursor: results.length > 0 ? encodeCursor(page + 1) : null,
    };
  }

  async getWork(userId: string, ref: string): Promise<WorkDetail> {
    const parsed = parseRef(ref, 'W');
    if (!parsed) throw invalidRef();

    if (parsed.kind === 'local') {
      const row = await this.repo.findWorkById(parsed.id);
      if (!row || !canView(row, userId)) throw notFound();
      return this.localDetail(userId, row);
    }

    // A work persisted earlier wins over Open Library, and the web gets its local id.
    const local = await this.repo.findWorkByOlKey(parsed.key);
    if (local && canView(local, userId)) return this.localDetail(userId, local);

    const work = await mapCatalogErrors(() => this.provider.getWork(parsed.key));
    const authors = await this.resolveAuthors(work.authorKeys);
    return externalWorkToDetail(work, authors);
  }

  /** A saved work, with the viewer's status. Open Library works keep their provider data. */
  private async localDetail(userId: string, row: WorkRow): Promise<WorkDetail> {
    const [detail, matches] = await Promise.all([
      row.olWorkKey
        ? this.withProviderData(row.id, row.olWorkKey, localWorkToDetail(row))
        : localWorkToDetail(row),
      this.library.find(userId, { workIds: [row.id] }),
    ]);
    return { ...detail, libraryStatus: matches.forWork(row.id) };
  }

  /** Never fails the request: without the provider the page shows the local data. */
  private async withProviderData(
    workId: string,
    olWorkKey: string,
    detail: WorkDetail,
  ): Promise<WorkDetail> {
    let external: ExternalWork | null = null;
    try {
      external = await this.provider.getWork(olWorkKey);
    } catch (error) {
      this.logger.warn(
        `saved work ${olWorkKey} without provider data: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    const savedCover = external?.coverUrl ? null : await this.repo.findSavedCoverUrl(workId);
    return overlayProviderWork(detail, external, savedCover);
  }

  /**
   * Search rows with the viewer's status. A row whose work, or a duplicate merged into it, is in
   * the library links to that saved work (SPEC 20).
   */
  private async toLibraryRows(userId: string, works: CollapsedWork[]): Promise<WorkSummary[]> {
    const matches = await this.library.find(userId, {
      olWorkKeys: works.flatMap((work) => work.mergedKeys),
    });
    return works.map((work) => {
      const summary = searchResultToSummary(work);
      const match = matches.forMergedRow(work.olWorkKey, work.mergedKeys);
      return match
        ? { ...summary, ref: match.workId, libraryStatus: match.libraryStatus }
        : summary;
    });
  }

  /** Summaries of local works, matched to the library by work id. */
  private async toLocalSummaries(userId: string, rows: WorkSummaryRow[]): Promise<WorkSummary[]> {
    const matches = await this.library.find(userId, { workIds: rows.map((row) => row.id) });
    return rows.map((row) => ({
      ...localWorkToSummary(row),
      libraryStatus: matches.forWork(row.id),
    }));
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

  /** A secondary provider search: a failure is logged and gives no results, it never fails the request. */
  private async bestEffort(
    label: string,
    run: () => Promise<WorkSearchResult[]>,
  ): Promise<WorkSearchResult[]> {
    try {
      return await run();
    } catch (error) {
      this.logger.warn(
        `${label} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  async getAuthor(userId: string, ref: string): Promise<AuthorDetail> {
    const parsed = parseRef(ref, 'A');
    if (!parsed) throw invalidRef();

    if (parsed.kind === 'local') {
      const row = await this.repo.findAuthorById(parsed.id);
      if (!row) throw notFound();
      return this.localAuthorDetail(userId, row);
    }
    const local = await this.repo.findAuthorByOlKey(parsed.key);
    if (local) return this.localAuthorDetail(userId, local);

    const [author, works] = await Promise.all([
      mapCatalogErrors(() => this.provider.getAuthor(parsed.key)),
      this.worksOfOlAuthor(userId, parsed.key),
    ]);
    return {
      ref: olRef(author.olAuthorKey),
      name: author.name,
      // Open Library bios carry Markdown; the cache stores them raw, so clean on the way out.
      bio: plainDescription(author.bio),
      birthYear: author.birthYear,
      deathYear: author.deathYear,
      photoUrl: author.photoUrl,
      works,
    };
  }

  private async localAuthorDetail(userId: string, local: Author): Promise<AuthorDetail> {
    const works = local.olAuthorKey
      ? await this.worksOfOlAuthor(userId, local.olAuthorKey)
      : await this.toLocalSummaries(userId, await this.repo.findPublicWorksByAuthor(local.id));
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

  /**
   * The main works of an Open Library author (SPEC 18): the first 3 pages of the author's works with
   * the most editions first, so a prolific author is not cut after 20 results. Bundles and split
   * books are dropped, duplicates are merged and the 1-edition tail is dropped. Ordered by
   * release year. Only the first page can fail the request.
   */
  private async worksOfOlAuthor(userId: string, olAuthorKey: string) {
    const query = authorWorksQuery(olAuthorKey);
    const search = (page: number) => this.provider.searchWorks(query, page, { sort: 'editions' });
    const [first, ...rest] = await Promise.all([
      mapCatalogErrors(() => search(1)),
      ...Array.from({ length: AUTHOR_WORK_PAGES - 1 }, (_, i) =>
        this.bestEffort(`author works page ${i + 2}`, () => search(i + 2)),
      ),
    ]);
    const unique = new Map<string, WorkSearchResult>();
    for (const result of [...first, ...rest.flat()]) {
      if (!isSeriesJunkTitle(result.title)) unique.set(result.olWorkKey, result);
    }
    const { items } = collapseSearchResults([...unique.values()], { guardVisible: true });
    return this.toLibraryRows(userId, sortByReleaseYear(items));
  }

  async getSeries(userId: string, id: string): Promise<SeriesDetail> {
    const olName = olSeriesName(id);
    if (olName !== null) return this.getOpenLibrarySeries(userId, id, olName);
    if (!isUuid(id)) throw invalidRef();
    const row = await this.repo.findSeriesById(id);
    if (!row) throw notFound();
    const summaries = await this.toLocalSummaries(userId, row.works);
    return {
      id: row.id,
      name: row.name,
      works: summaries.map((summary, index) => ({
        ...summary,
        position: decimalToNumber(row.works[index]?.seriesPosition ?? null),
      })),
    };
  }

  /**
   * A series derived from Open Library subjects (SPEC 18). Open Library tags series unevenly, so
   * three first-page searches are merged: the `series:` subject (trusted), the `series` field,
   * and the series name in titles by the main author. The union is filtered (main author, enough
   * editions, no parts or bundles), duplicates are merged and the 1-edition tail is dropped. Only
   * the subject search can fail the request; the other two are best effort. Open Library has no
   * series positions, so every position is null.
   */
  private async getOpenLibrarySeries(
    userId: string,
    id: string,
    name: string,
  ): Promise<SeriesDetail> {
    const search = (query: string) => this.provider.searchWorks(query, 1);
    const [tagged, byField] = await Promise.all([
      mapCatalogErrors(() => search(seriesSearchQuery(name))),
      this.bestEffort('series field search', () => search(seriesFieldQuery(name))),
    ]);
    const seeds =
      tagged.length > 0
        ? tagged.filter((result) => !isSeriesJunkTitle(result.title))
        : byField.filter(
            (result) =>
              result.editionCount >= MIN_EDITIONS_FOR_TEXT_MATCH &&
              !isSeriesJunkTitle(result.title),
          );
    const author = mainAuthor(seeds);
    const byTitle = author
      ? await this.bestEffort('series title search', () =>
          search(seriesTitleQuery(name, author.name)),
        )
      : [];
    const results = selectSeriesWorks({
      tagged,
      textMatches: [...byField, ...byTitle],
      authorKey: author?.olAuthorKey ?? null,
    });
    const { items } = collapseSearchResults(results, { guardVisible: true });
    if (items.length === 0) throw notFound();
    // Open Library has no positions and dates early editions badly: order by release year.
    const works = await this.toLibraryRows(userId, sortByReleaseYear(items));
    return { id, name, works: works.map((work) => ({ ...work, position: null })) };
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

  /**
   * The work a user wants to add: a saved work they can see, or an Open Library work that is not
   * saved yet. Reads only.
   */
  async findWorkForLibrary(userId: string, ref: string): Promise<LibraryTarget> {
    const parsed = parseRef(ref, 'W');
    if (!parsed) throw invalidRef();
    const row =
      parsed.kind === 'local'
        ? await this.repo.findWorkById(parsed.id)
        : await this.repo.findWorkByOlKey(parsed.key);
    if (row) {
      if (!canView(row, userId)) throw notFound();
      return { workId: row.id, olWorkKey: row.olWorkKey };
    }
    if (parsed.kind === 'local') throw notFound();
    return { workId: null, olWorkKey: parsed.key };
  }

  /**
   * Chooses the edition and saves what is missing: the only place that writes catalog rows. The
   * edition must belong to the work (SPEC 20). Without `editionRef` it is the default one.
   */
  async saveForLibrary(
    target: LibraryTarget,
    choice: { editionRef?: string; locale: string },
  ): Promise<SavedBook> {
    let requested: CatalogRef | null = null;
    if (choice.editionRef !== undefined) {
      requested = parseRef(choice.editionRef, 'M');
      if (!requested) throw invalidRef();
    }
    // An edition already saved for this work needs no provider, so an outage does not matter.
    if (target.workId !== null && requested) {
      const saved = await this.repo.findEditionOfWork(
        target.workId,
        requested.kind === 'local' ? { id: requested.id } : { olEditionKey: requested.key },
      );
      if (saved) return savedBook(target.workId, saved);
    }
    // Any other local id is not an edition of this work.
    if (requested?.kind === 'local') throw editionNotInWork();

    if (target.olWorkKey === null) {
      // A manual work: only its saved editions exist.
      if (requested) throw editionNotInWork();
      const editions = await this.repo.findEditionsByWork(target.workId);
      const original = originalLanguage(editions);
      const chosen = pickDefaultEdition(
        editions.map((edition) => ({
          edition,
          language: edition.language,
          isOriginalLanguage: original !== null && edition.language === original,
        })),
        choice.locale,
      );
      if (!chosen) throw noEdition();
      return savedBook(target.workId, chosen.edition);
    }

    const { olWorkKey } = target;
    const chosen = await this.chooseExternalEdition(olWorkKey, requested?.key, choice.locale);
    const existing = await this.repo.findEditionByOlKey(chosen.olEditionKey);
    // Read the work after the edition: a concurrent add may have saved both since the lookup.
    const workId = target.workId ?? (await this.repo.findWorkByOlKey(olWorkKey))?.id ?? null;
    if (existing && existing.workId !== workId) throw editionNotInWork();

    const work = workId === null ? await this.fetchWorkRecord(olWorkKey) : null;
    const saved = await this.repo.saveOpenLibraryBook(olWorkKey, work, toEditionRecord(chosen));
    // Only a concurrent add can still bring an edition of another work.
    if (saved.edition.workId !== saved.workId) throw editionNotInWork();
    return savedBook(saved.workId, saved.edition);
  }

  /** The requested edition, or the default one, out of the provider list of the work. */
  private async chooseExternalEdition(
    olWorkKey: string,
    requestedKey: string | undefined,
    locale: string,
  ): Promise<ExternalEdition> {
    const editions = await mapCatalogErrors(() => this.provider.listEditions(olWorkKey, {}));
    if (requestedKey !== undefined) {
      const requested = editions.find((edition) => edition.olEditionKey === requestedKey);
      if (!requested) throw editionNotInWork();
      return requested;
    }
    const original = originalLanguage(editions);
    // Ranked like the editions endpoint, so the default is the one the work page shows.
    const chosen = pickDefaultEdition(
      rankEditions(editions).map((edition) => ({
        edition,
        language: edition.language,
        isOriginalLanguage: original !== null && edition.language === original,
      })),
      locale,
    );
    if (!chosen) throw noEdition();
    return chosen.edition;
  }

  private async fetchWorkRecord(olWorkKey: string): Promise<WorkRecord> {
    const work = await mapCatalogErrors(() => this.provider.getWork(olWorkKey));
    return toWorkRecord(olWorkKey, work, await this.fetchAuthors(work.authorKeys));
  }

  /** At most MAX_AUTHORS. An author Open Library no longer knows is dropped; an outage fails. */
  private async fetchAuthors(authorKeys: string[]): Promise<ExternalAuthor[]> {
    const found = await Promise.all(
      [...new Set(authorKeys)].slice(0, MAX_AUTHORS).map(async (key) => {
        try {
          return await mapCatalogErrors(() => this.provider.getAuthor(key));
        } catch (error) {
          if (error instanceof ApiException && error.code === ErrorCode.CATALOG_NOT_FOUND) {
            return null;
          }
          throw error;
        }
      }),
    );
    return found.filter((author): author is ExternalAuthor => author !== null);
  }

  private async resolveAuthors(authorKeys: string[]): Promise<AuthorLink[]> {
    const authors = await this.fetchAuthors(authorKeys);
    return authors.map((author) => ({ ref: olRef(author.olAuthorKey), name: author.name }));
  }
}
