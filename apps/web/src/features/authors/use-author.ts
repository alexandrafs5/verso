'use client';

import { useQuery } from '@tanstack/react-query';
import { authorDetailSchema } from '@verso/shared';
import { CATALOG_STALE_MS } from '@/features/works/use-work';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useAuthor(ref: string) {
  return useQuery({
    queryKey: queryKeys.author(ref),
    queryFn: ({ signal }) =>
      api.get(`/api/v1/authors/${encodeURIComponent(ref)}`, authorDetailSchema, { signal }),
    staleTime: CATALOG_STALE_MS,
  });
}
