import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildSearchPath, parseSearchParams, useSearchBooks } from './use-search-books';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function page(refs: string[], nextCursor: string | null) {
  return new Response(
    JSON.stringify({
      items: refs.map((ref) => ({
        ref,
        title: `Title ${ref}`,
        authors: [],
        firstPublishYear: null,
        coverUrl: null,
        editionCount: 3,
        libraryStatus: null,
      })),
      nextCursor,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('parseSearchParams', () => {
  it('trims and accepts a valid query', () => {
    expect(parseSearchParams({ q: '  dune ', genre: ' Fiction ', minLength: 2 })).toEqual({
      q: 'dune',
      genre: 'Fiction',
    });
  });

  it('rejects below the minimum length', () => {
    expect(parseSearchParams({ q: 'd', minLength: 2 })).toBeNull();
    expect(parseSearchParams({ q: ' d ', minLength: 2 })).toBeNull();
    expect(parseSearchParams({ q: 'd', minLength: 1 })).toEqual({ q: 'd', genre: undefined });
  });

  it('rejects q over 200 and genre over 80 characters', () => {
    expect(parseSearchParams({ q: 'a'.repeat(201), minLength: 1 })).toBeNull();
    expect(parseSearchParams({ q: 'a', genre: 'g'.repeat(81), minLength: 1 })).toBeNull();
  });

  it('treats a blank genre as no genre', () => {
    expect(parseSearchParams({ q: 'dune', genre: '  ', minLength: 1 })).toEqual({
      q: 'dune',
      genre: undefined,
    });
  });
});

describe('buildSearchPath', () => {
  it('encodes q, genre and cursor', () => {
    expect(buildSearchPath({ q: 'Pedro Páramo', genre: 'Magic realism' }, 'abc')).toBe(
      '/api/v1/search/books?q=Pedro+P%C3%A1ramo&genre=Magic+realism&cursor=abc',
    );
  });

  it('omits genre and cursor when absent', () => {
    expect(buildSearchPath({ q: 'dune' })).toBe('/api/v1/search/books?q=dune');
  });
});

describe('useSearchBooks', () => {
  it('sends no request below the minimum length', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSearchBooks({ q: 'd', minLength: 2 }), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pages with nextCursor until it is null', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(page(['ol:OL1W'], 'cur2'))
      .mockResolvedValueOnce(page(['ol:OL2W'], null));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useSearchBooks({ q: 'dune', minLength: 1 }), { wrapper });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1));
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(String(fetchMock.mock.calls[1]?.[0])).toContain('cursor=cur2');
  });
});
