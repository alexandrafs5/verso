import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { GENRES } from '@verso/shared';
import { messages } from '@verso/i18n';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthor } from '../authors/use-author';
import { useSeries } from '../series/use-series';
import { useWork } from './use-work';
import { useWorkEditions } from './use-work-editions';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': status === 200 ? 'application/json' : 'application/problem+json' },
  });

const SERIES_ID = '0190f0f0-1234-7abc-8def-0123456789ab';
const edition = {
  ref: 'ol:OL1M',
  title: 'Pedro Páramo',
  isbn10: null,
  isbn13: '9788437604947',
  publisher: 'Cátedra',
  publishYear: 1955,
  language: 'es',
  pageCount: 128,
  format: 'PAPERBACK',
  coverUrl: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('catalog read hooks', () => {
  it('useWork requests the encoded ref and parses the work', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reply({
        ref: 'ol:OL1W',
        title: 'Pedro Páramo',
        subtitle: null,
        description: null,
        firstPublishYear: 1955,
        coverUrl: null,
        authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
        genres: ['Fiction'],
        series: null,
        source: 'OPEN_LIBRARY',
        libraryStatus: null,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useWork('ol:OL1W'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/v1/works/ol%3AOL1W');
    expect(result.current.data?.title).toBe('Pedro Páramo');
  });

  it('useWork exposes a 404 as an error without retrying', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        reply(
          { type: 'about:blank', title: 'Not found', status: 404, code: 'CATALOG_NOT_FOUND' },
          404,
        ),
      );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useWork('ol:OL9W'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('useWorkEditions parses a list of editions', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply([edition]));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useWorkEditions('ol:OL1W'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/v1/works/ol%3AOL1W/editions');
    expect(result.current.data).toHaveLength(1);
  });

  it('useAuthor requests the encoded author ref', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      reply({
        ref: 'ol:OL1A',
        name: 'Juan Rulfo',
        bio: null,
        birthYear: 1917,
        deathYear: 1986,
        photoUrl: null,
        works: [],
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAuthor('ol:OL1A'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe('/api/v1/authors/ol%3AOL1A');
  });

  it('useSeries requests the series id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply({ id: SERIES_ID, name: 'Saga', works: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSeries(SERIES_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(`/api/v1/series/${SERIES_ID}`);
  });
});

describe('genre labels', () => {
  it('has an EN and an ES label for every genre slug', () => {
    for (const { slug } of GENRES) {
      expect(messages.en.genres).toHaveProperty([slug]);
      expect(messages.es.genres).toHaveProperty([slug]);
    }
  });
});
