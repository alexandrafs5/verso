'use client';

import { useQuery } from '@tanstack/react-query';
import { editionDtoSchema } from '@verso/shared';
import { z } from 'zod';
import { api } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { CATALOG_STALE_MS, workPath } from './use-work';

const editionsSchema = z.array(editionDtoSchema);

/** All editions of a work. Language filtering is done on the client (SPEC 18). */
export function useWorkEditions(ref: string) {
  return useQuery({
    queryKey: queryKeys.workEditions(ref),
    queryFn: ({ signal }) => api.get(`${workPath(ref)}/editions`, editionsSchema, { signal }),
    staleTime: CATALOG_STALE_MS,
  });
}
