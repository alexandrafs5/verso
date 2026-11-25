import { createHash } from 'node:crypto';
import { Logger } from '@nestjs/common';
import { z } from 'zod';
import {
  externalAuthorSchema,
  externalEditionSchema,
  externalWorkSchema,
  workSearchResultSchema,
} from './catalog-cache-schemas.js';
import { CatalogNotFoundError, CatalogUnavailableError } from './catalog-errors.js';
import {
  type CatalogProvider,
  type ExternalAuthor,
  type ExternalEdition,
  type ExternalWork,
  SEARCH_PAGE_SIZE,
  type SearchOptions,
  type WorkSearchResult,
} from './catalog-provider.js';
import { buildUserAgent } from './catalog-env.js';
import type { ExternalCacheStore } from './external-cache.js';
import {
  authorSchema,
  editionSchema,
  editionsResponseSchema,
  isAuthorKey,
  isWorkKey,
  mapAuthor,
  mapEdition,
  mapSearchDoc,
  mapWork,
  normalizeIsbn,
  searchResponseSchema,
  workSchema,
} from './open-library-mappers.js';

const BASE_URL = 'https://openlibrary.org';
const REQUEST_TIMEOUT_MS = 8000;
const EDITIONS_LIMIT = 100;
const SEARCH_FIELDS =
  'key,title,author_name,author_key,first_publish_year,cover_i,edition_count,language,publish_year';

export const SEARCH_TTL_SECONDS = 24 * 60 * 60;
export const DETAIL_TTL_SECONDS = 30 * 24 * 60 * 60;

type FetchLike = typeof fetch;
type WarnLogger = { warn(message: string): void };

export type OpenLibraryProviderOptions = {
  /** Contact shown in the User-Agent. */
  contact: string;
  cache: ExternalCacheStore;
  fetchImpl?: FetchLike;
  baseUrl?: string;
  logger?: WarnLogger;
};

export class OpenLibraryProvider implements CatalogProvider {
  private readonly userAgent: string;
  private readonly cache: ExternalCacheStore;
  private readonly fetchImpl: FetchLike;
  private readonly baseUrl: string;
  private readonly logger: WarnLogger;

  constructor(options: OpenLibraryProviderOptions) {
    this.userAgent = buildUserAgent(options.contact);
    this.cache = options.cache;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.baseUrl = options.baseUrl ?? BASE_URL;
    this.logger = options.logger ?? new Logger(OpenLibraryProvider.name);
  }

  async searchWorks(
    query: string,
    page: number,
    opts: SearchOptions = {},
  ): Promise<WorkSearchResult[]> {
    const q = query.trim().replace(/\s+/g, ' ');
    if (!q) return [];
    const pageNumber = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
    const sort = opts.sort ?? '';
    const hash = createHash('sha256')
      .update(`${q.toLowerCase()}|${pageNumber}|${sort}`)
      .digest('hex');

    const results = await this.cached(
      `ol:search:${hash}`,
      SEARCH_TTL_SECONDS,
      z.array(workSearchResultSchema),
      async () => {
        const params = new URLSearchParams({
          q,
          page: String(pageNumber),
          limit: String(SEARCH_PAGE_SIZE),
          fields: SEARCH_FIELDS,
          ...(sort ? { sort } : {}),
        });
        const body = this.parse(searchResponseSchema, await this.getJson(`/search.json?${params}`));
        return body.docs.flatMap((doc) => mapSearchDoc(doc) ?? []);
      },
    );
    return results ?? [];
  }

  async getWork(olWorkKey: string): Promise<ExternalWork> {
    const key = this.requireKey(olWorkKey, isWorkKey, 'work');
    const work = await this.cached(
      `ol:work:${key}`,
      DETAIL_TTL_SECONDS,
      externalWorkSchema,
      async () => mapWork(this.parse(workSchema, await this.getJson(`/works/${key}.json`))),
    );
    return work as ExternalWork;
  }

  async listEditions(olWorkKey: string, opts: { language?: string }): Promise<ExternalEdition[]> {
    const key = this.requireKey(olWorkKey, isWorkKey, 'work');
    const language = opts.language?.trim().toLowerCase() || undefined;

    const editions = await this.cached(
      `ol:editions:${key}:${language ?? 'all'}`,
      DETAIL_TTL_SECONDS,
      z.array(externalEditionSchema),
      async () => {
        const body = this.parse(
          editionsResponseSchema,
          await this.getJson(`/works/${key}/editions.json?limit=${EDITIONS_LIMIT}`),
        );
        const all = body.entries.flatMap((entry) => mapEdition(entry) ?? []);
        return language ? all.filter((edition) => edition.language === language) : all;
      },
    );
    return editions ?? [];
  }

  async getEditionByIsbn(isbn: string): Promise<ExternalEdition | null> {
    const normalized = normalizeIsbn(isbn);
    if (!normalized) return null;

    return this.cached(
      `ol:isbn:${normalized}`,
      DETAIL_TTL_SECONDS,
      externalEditionSchema,
      async () => {
        let raw: unknown;
        try {
          raw = await this.getJson(`/isbn/${normalized}.json`);
        } catch (error) {
          if (error instanceof CatalogNotFoundError) return null;
          throw error;
        }
        const edition = mapEdition(this.parse(editionSchema, raw));
        if (!edition) throw new CatalogUnavailableError('Unexpected Open Library edition response');
        return edition;
      },
    );
  }

  async getAuthor(olAuthorKey: string): Promise<ExternalAuthor> {
    const key = this.requireKey(olAuthorKey, isAuthorKey, 'author');
    const author = await this.cached(
      `ol:author:${key}`,
      DETAIL_TTL_SECONDS,
      externalAuthorSchema,
      async () => mapAuthor(this.parse(authorSchema, await this.getJson(`/authors/${key}.json`))),
    );
    return author as ExternalAuthor;
  }

  /** Keys are validated before they go into a URL path. */
  private requireKey(value: string, isValid: (key: string) => boolean, kind: string): string {
    const key = value.trim();
    if (!isValid(key)) throw new CatalogNotFoundError(`Invalid ${kind} key`);
    return key;
  }

  private parse<T>(schema: z.ZodType<T>, data: unknown): T {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new CatalogUnavailableError('Unexpected Open Library response', {
        cause: result.error,
      });
    }
    return result.data;
  }

  /**
   * Reads through the cache. A cache error or an invalid cached value is logged or ignored and the
   * loader runs instead. Only non-null values are stored, so misses and errors are never cached.
   */
  private async cached<T>(
    key: string,
    ttlSeconds: number,
    schema: z.ZodType<T>,
    load: () => Promise<T | null>,
  ): Promise<T | null> {
    try {
      const hit = await this.cache.get(key);
      if (hit !== null) {
        const parsed = schema.safeParse(hit);
        if (parsed.success) return parsed.data;
      }
    } catch (error) {
      this.logger.warn(`ExternalCache read failed for ${key}: ${describe(error)}`);
    }

    const value = await load();
    if (value === null) return null;

    try {
      await this.cache.set(key, value, ttlSeconds);
    } catch (error) {
      this.logger.warn(`ExternalCache write failed for ${key}: ${describe(error)}`);
    }
    return value;
  }

  private async getJson(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new CatalogUnavailableError('Open Library request failed', { cause: error });
    }

    if (response.status === 404) throw new CatalogNotFoundError();
    if (!response.ok) {
      throw new CatalogUnavailableError(`Open Library responded with ${response.status}`);
    }
    try {
      return (await response.json()) as unknown;
    } catch (error) {
      throw new CatalogUnavailableError('Open Library returned invalid JSON', { cause: error });
    }
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
