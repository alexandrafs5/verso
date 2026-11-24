import { afterEach, describe, expect, it, vi } from 'vitest';
import { CatalogNotFoundError, CatalogUnavailableError } from './catalog-errors.js';
import type { ExternalCacheStore } from './external-cache.js';
import { InMemoryExternalCache } from './in-memory-external-cache.js';
import {
  DETAIL_TTL_SECONDS,
  OpenLibraryProvider,
  SEARCH_TTL_SECONDS,
} from './open-library.provider.js';
import { loadFixture } from './test-fixtures.js';

type Route = { status?: number; body?: unknown; raw?: string };

function setup(
  routes: Record<string, Route>,
  cache: ExternalCacheStore = new InMemoryExternalCache(),
) {
  const fetchImpl = vi.fn((input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input));
    const route = routes[url.pathname];
    if (!route) return Promise.resolve(new Response('{}', { status: 404 }));
    const body = route.raw ?? JSON.stringify(route.body ?? {});
    void init;
    return Promise.resolve(new Response(body, { status: route.status ?? 200 }));
  });
  const logger = { warn: vi.fn() };
  const provider = new OpenLibraryProvider({
    contact: 'test@example.org',
    cache,
    fetchImpl: fetchImpl as unknown as typeof fetch,
    logger,
  });
  return { provider, fetchImpl, cache, logger };
}

const routes = (): Record<string, Route> => ({
  '/search.json': { body: loadFixture('search-pedro-paramo.json') },
  '/works/OL1731119W.json': { body: loadFixture('work-OL1731119W.json') },
  '/works/OL1731119W/editions.json': { body: loadFixture('editions-OL1731119W.json') },
  '/isbn/9788475060927.json': { body: loadFixture('isbn-9788475060927.json') },
  '/authors/OL199285A.json': { body: loadFixture('author-OL199285A.json') },
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('searchWorks', () => {
  it('maps the search fixture', async () => {
    const { provider } = setup(routes());
    const results = await provider.searchWorks('Pedro Páramo', 1);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toMatchObject({
      olWorkKey: 'OL1731119W',
      title: 'Pedro Páramo',
      firstPublishYear: 1955,
      coverUrl: 'https://covers.openlibrary.org/b/id/5419076-M.jpg',
    });
    expect(results[0]?.authors[0]?.name).toBe('Juan Rulfo');
  });

  it('sends q, page, limit and fields', async () => {
    const { provider, fetchImpl } = setup(routes());
    await provider.searchWorks('  Pedro   Páramo ', 2);
    const url = new URL(String(fetchImpl.mock.calls[0]?.[0]));
    expect(url.searchParams.get('q')).toBe('Pedro Páramo');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('fields')).toContain('cover_i');
  });

  it('returns [] and makes no call for an empty or blank query', async () => {
    const { provider, fetchImpl } = setup(routes());
    expect(await provider.searchWorks('', 1)).toEqual([]);
    expect(await provider.searchWorks('   ', 1)).toEqual([]);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats an invalid page as page 1', async () => {
    const { provider, fetchImpl } = setup(routes());
    await provider.searchWorks('pedro', 0);
    expect(new URL(String(fetchImpl.mock.calls[0]?.[0])).searchParams.get('page')).toBe('1');
  });
});

describe('getWork, getAuthor', () => {
  it('maps the work', async () => {
    const { provider } = setup(routes());
    expect(await provider.getWork('OL1731119W')).toMatchObject({
      olWorkKey: 'OL1731119W',
      authorKeys: ['OL199285A'],
      firstPublishYear: 1955,
    });
  });

  it('maps the author', async () => {
    const { provider } = setup(routes());
    expect(await provider.getAuthor('OL199285A')).toMatchObject({
      name: 'Juan Rulfo',
      birthYear: 1917,
      deathYear: 1986,
    });
  });

  it('throws CatalogNotFoundError on 404', async () => {
    const { provider } = setup({});
    await expect(provider.getWork('OL1W')).rejects.toBeInstanceOf(CatalogNotFoundError);
    await expect(provider.getAuthor('OL1A')).rejects.toBeInstanceOf(CatalogNotFoundError);
  });

  it('throws CatalogNotFoundError for malformed keys without a call', async () => {
    const { provider, fetchImpl } = setup(routes());
    await expect(provider.getWork('../etc/passwd')).rejects.toBeInstanceOf(CatalogNotFoundError);
    await expect(provider.getWork('OL1A')).rejects.toBeInstanceOf(CatalogNotFoundError);
    await expect(provider.getWork('/works/OL1731119W')).rejects.toBeInstanceOf(
      CatalogNotFoundError,
    );
    await expect(provider.getAuthor('OL1W')).rejects.toBeInstanceOf(CatalogNotFoundError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('listEditions', () => {
  it('returns all editions without a language', async () => {
    const { provider } = setup(routes());
    const editions = await provider.listEditions('OL1731119W', {});
    expect(editions).toHaveLength(8);
    expect(editions.some((edition) => edition.language === null)).toBe(true);
  });

  it('filters by language', async () => {
    const { provider } = setup(routes());
    const spanish = await provider.listEditions('OL1731119W', { language: 'es' });
    expect(spanish.length).toBeGreaterThan(0);
    expect(spanish.every((edition) => edition.language === 'es')).toBe(true);
    const english = await provider.listEditions('OL1731119W', { language: 'EN' });
    expect(english.map((edition) => edition.olEditionKey)).toEqual(
      expect.arrayContaining(['OL62697460M', 'OL58980464M']),
    );
  });

  it('skips entries that cannot be mapped', async () => {
    const { provider } = setup({
      '/works/OL1W/editions.json': {
        body: { entries: [{ key: '/books/OL1M', title: 'Ok' }, { key: '/books/OL2M' }] },
      },
    });
    const editions = await provider.listEditions('OL1W', {});
    expect(editions.map((edition) => edition.olEditionKey)).toEqual(['OL1M']);
  });

  it('throws CatalogNotFoundError for a malformed key', async () => {
    const { provider } = setup(routes());
    await expect(provider.listEditions('nope', {})).rejects.toBeInstanceOf(CatalogNotFoundError);
  });
});

describe('getEditionByIsbn', () => {
  it('maps the edition and normalizes the ISBN', async () => {
    const { provider } = setup(routes());
    expect(await provider.getEditionByIsbn('978-84-7506-092-7')).toMatchObject({
      olEditionKey: 'OL47268921M',
      isbn13: '9788475060927',
      language: 'es',
    });
  });

  it('returns null on 404 and does not cache the miss', async () => {
    const { provider, fetchImpl, cache } = setup({});
    expect(await provider.getEditionByIsbn('9780000000002')).toBeNull();
    expect(await provider.getEditionByIsbn('9780000000002')).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect((cache as InMemoryExternalCache).size).toBe(0);
  });

  it('returns null for a malformed ISBN without a call', async () => {
    const { provider, fetchImpl } = setup(routes());
    expect(await provider.getEditionByIsbn('12345')).toBeNull();
    expect(await provider.getEditionByIsbn('')).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('still throws CatalogUnavailableError on a 500', async () => {
    const { provider } = setup({ '/isbn/9788475060927.json': { status: 500 } });
    await expect(provider.getEditionByIsbn('9788475060927')).rejects.toBeInstanceOf(
      CatalogUnavailableError,
    );
  });
});

describe('requests', () => {
  it('send the User-Agent and an 8000 ms timeout signal', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const { provider, fetchImpl } = setup(routes());
    await provider.getWork('OL1731119W');
    const init = fetchImpl.mock.calls[0]?.[1];
    expect(new Headers(init?.headers).get('User-Agent')).toBe('Verso/1.0 (test@example.org)');
    expect(timeout).toHaveBeenCalledWith(8000);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('call openlibrary.org', async () => {
    const { provider, fetchImpl } = setup(routes());
    await provider.getAuthor('OL199285A');
    expect(String(fetchImpl.mock.calls[0]?.[0])).toBe(
      'https://openlibrary.org/authors/OL199285A.json',
    );
  });
});

describe('errors', () => {
  it('maps a timeout to CatalogUnavailableError', async () => {
    const provider = new OpenLibraryProvider({
      contact: 'x',
      cache: new InMemoryExternalCache(),
      fetchImpl: (() =>
        Promise.reject(new DOMException('timed out', 'TimeoutError'))) as unknown as typeof fetch,
      logger: { warn: vi.fn() },
    });
    await expect(provider.getWork('OL1W')).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it('maps a network error to CatalogUnavailableError', async () => {
    const provider = new OpenLibraryProvider({
      contact: 'x',
      cache: new InMemoryExternalCache(),
      fetchImpl: (() => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch,
      logger: { warn: vi.fn() },
    });
    await expect(provider.searchWorks('a', 1)).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it.each([429, 500, 503, 403])('maps status %i to CatalogUnavailableError', async (status) => {
    const { provider } = setup({ '/works/OL1W.json': { status } });
    await expect(provider.getWork('OL1W')).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it('maps invalid JSON to CatalogUnavailableError', async () => {
    const { provider } = setup({ '/works/OL1W.json': { raw: '<html>oops</html>' } });
    await expect(provider.getWork('OL1W')).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it('maps an unexpected shape to CatalogUnavailableError', async () => {
    const { provider } = setup({
      '/works/OL1W.json': { body: { nope: true } },
      '/search.json': { body: { docs: 'x' } },
    });
    await expect(provider.getWork('OL1W')).rejects.toBeInstanceOf(CatalogUnavailableError);
    await expect(provider.searchWorks('a', 1)).rejects.toBeInstanceOf(CatalogUnavailableError);
  });

  it('does not cache errors', async () => {
    const r = routes();
    const failing = { ...r, '/works/OL1731119W.json': { status: 500 } };
    const { provider, cache, fetchImpl } = setup(failing);
    await expect(provider.getWork('OL1731119W')).rejects.toBeInstanceOf(CatalogUnavailableError);
    expect((cache as InMemoryExternalCache).size).toBe(0);
    await expect(provider.getWork('OL1731119W')).rejects.toBeInstanceOf(CatalogUnavailableError);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

describe('cache', () => {
  it('serves the second identical call from the cache', async () => {
    const { provider, fetchImpl } = setup(routes());
    const first = await provider.getWork('OL1731119W');
    const second = await provider.getWork('OL1731119W');
    expect(second).toEqual(first);
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    await provider.searchWorks('pedro', 1);
    await provider.searchWorks('PEDRO ', 1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await provider.searchWorks('pedro', 2);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('uses 1 day for search and 30 days for everything else', async () => {
    expect(SEARCH_TTL_SECONDS).toBe(86_400);
    expect(DETAIL_TTL_SECONDS).toBe(2_592_000);
    const { provider, cache } = setup(routes());
    const set = vi.spyOn(cache, 'set');
    await provider.searchWorks('pedro', 1);
    await provider.getWork('OL1731119W');
    await provider.listEditions('OL1731119W', { language: 'es' });
    await provider.getEditionByIsbn('9788475060927');
    await provider.getAuthor('OL199285A');

    const calls = set.mock.calls.map(([key, , ttl]) => ({ key, ttl }));
    expect(calls).toEqual([
      { key: expect.stringMatching(/^ol:search:[0-9a-f]{64}$/), ttl: 86_400 },
      { key: 'ol:work:OL1731119W', ttl: 2_592_000 },
      { key: 'ol:editions:OL1731119W:es', ttl: 2_592_000 },
      { key: 'ol:isbn:9788475060927', ttl: 2_592_000 },
      { key: 'ol:author:OL199285A', ttl: 2_592_000 },
    ]);
  });

  it('keeps editions for each language separately', async () => {
    const { provider, fetchImpl } = setup(routes());
    await provider.listEditions('OL1731119W', {});
    await provider.listEditions('OL1731119W', { language: 'es' });
    await provider.listEditions('OL1731119W', { language: 'es' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('refetches after the entry expires', async () => {
    let now = 0;
    const cache = new InMemoryExternalCache(() => now);
    const { provider, fetchImpl } = setup(routes(), cache);
    await provider.getAuthor('OL199285A');
    now += (DETAIL_TTL_SECONDS - 1) * 1000;
    await provider.getAuthor('OL199285A');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    now += 2000;
    await provider.getAuthor('OL199285A');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('treats an invalid cached payload as a miss and replaces it', async () => {
    const cache = new InMemoryExternalCache();
    await cache.set('ol:work:OL1731119W', { title: 123 }, 1000);
    const { provider, fetchImpl } = setup(routes(), cache);
    expect(await provider.getWork('OL1731119W')).toMatchObject({ title: 'Pedro Páramo' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(await provider.getWork('OL1731119W')).toMatchObject({ title: 'Pedro Páramo' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('is fail-open when the cache read throws', async () => {
    const broken: ExternalCacheStore = {
      get: () => Promise.reject(new Error('db down')),
      set: () => Promise.resolve(),
      deleteExpired: () => Promise.resolve(0),
    };
    const { provider, logger } = setup(routes(), broken);
    expect(await provider.getWork('OL1731119W')).toMatchObject({ olWorkKey: 'OL1731119W' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('read failed'));
  });

  it('is fail-open when the cache write throws', async () => {
    const broken: ExternalCacheStore = {
      get: () => Promise.resolve(null),
      set: () => Promise.reject(new Error('db down')),
      deleteExpired: () => Promise.resolve(0),
    };
    const { provider, logger } = setup(routes(), broken);
    expect(await provider.getAuthor('OL199285A')).toMatchObject({ name: 'Juan Rulfo' });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('write failed'));
  });
});
