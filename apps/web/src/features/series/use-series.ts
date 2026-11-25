'use client';

import { useQuery } from '@tanstack/react-query';
import { seriesDetailSchema } from '@verso/shared';
import { CATALOG_STALE_MS } from '@/features/works/use-work';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';

export function useSeries(id: string) {
  return useQuery({
    queryKey: queryKeys.series(id),
    queryFn: ({ signal }) =>
      api.get(`/api/v1/series/${encodeURIComponent(id)}`, seriesDetailSchema, { signal }),
    staleTime: CATALOG_STALE_MS,
  });
}
