'use client';

import { useQuery } from '@tanstack/react-query';
import { workDetailSchema } from '@verso/shared';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export const CATALOG_STALE_MS = 5 * 60_000;

export const workPath = (ref: string): string => `/api/v1/works/${encodeURIComponent(ref)}`;

export function useWork(ref: string) {
  return useQuery({
    queryKey: queryKeys.work(ref),
    queryFn: ({ signal }) => api.get(workPath(ref), workDetailSchema, { signal }),
    staleTime: CATALOG_STALE_MS,
  });
}
