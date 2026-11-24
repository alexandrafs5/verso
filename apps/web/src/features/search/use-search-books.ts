'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import {
  type SearchBooksQuery,
  searchBooksQuerySchema,
  searchBooksResponseSchema,
} from '@verso/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export const SEARCH_STALE_MS = 60_000;

type Params = {
  q: string;
  genre?: string;
  /** Shortest trimmed query that sends a request. */
  minLength: number;
};

/** Returns the parsed query when it is valid and long enough, otherwise null. */
export function parseSearchParams({ q, genre, minLength }: Params): SearchBooksQuery | null {
  const trimmed = q.trim();
  if (trimmed.length < minLength) return null;
  const parsed = searchBooksQuerySchema.safeParse({
    q: trimmed,
    genre: genre?.trim() || undefined,
  });
  return parsed.success ? parsed.data : null;
}

export function buildSearchPath(query: SearchBooksQuery, cursor?: string): string {
  const params = new URLSearchParams({ q: query.q });
  if (query.genre) params.set('genre', query.genre);
  if (cursor) params.set('cursor', cursor);
  return `/api/v1/search/books?${params.toString()}`;
}

export function useSearchBooks(params: Params) {
  const query = parseSearchParams(params);
  return useInfiniteQuery({
    queryKey: queryKeys.searchBooks(query?.q ?? '', query?.genre),
    queryFn: ({ pageParam, signal }) =>
      api.get(buildSearchPath(query as SearchBooksQuery, pageParam), searchBooksResponseSchema, {
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: query !== null,
    staleTime: SEARCH_STALE_MS,
  });
}
