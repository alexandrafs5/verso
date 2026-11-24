'use client';

import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import {
  type SearchBooksQuery,
  type SearchBooksResponse,
  searchBooksQuerySchema,
  searchBooksResponseSchema,
  type WorkSummary,
} from '@verso/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export const SEARCH_STALE_MS = 60_000;

type Params = {
  q: string;
  genre?: string;
  /** Shortest trimmed query that sends a request. */
  minLength: number;
  /** Keep the last results on screen while a new query loads. */
  keepPrevious?: boolean;
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

/** Main rows and the folded tail of every loaded page, in page order (SPEC 17). */
export function flattenSearchPages(pages: SearchBooksResponse[] | undefined): {
  items: WorkSummary[];
  moreMatches: WorkSummary[];
} {
  return {
    items: pages?.flatMap((page) => page.items) ?? [],
    moreMatches: pages?.flatMap((page) => page.moreMatches) ?? [],
  };
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
    placeholderData: params.keepPrevious ? keepPreviousData : undefined,
    staleTime: SEARCH_STALE_MS,
  });
}
