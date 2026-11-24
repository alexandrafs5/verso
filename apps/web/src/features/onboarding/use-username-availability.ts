'use client';

import { useQuery } from '@tanstack/react-query';
import type { UsernameAvailability } from '@verso/shared';
import { queryKeys } from '@/lib/query-keys';
import { AVAILABILITY_STALE_MS, fetchAvailability } from './availability';
import { useDebouncedValue } from '@/lib/use-debounced-value';

export const AVAILABILITY_DEBOUNCE_MS = 400;

export type AvailabilityState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; reason: NonNullable<UsernameAvailability['reason']> }
  | { kind: 'error' };

/**
 * Live check while typing. A failed check is its own state: it must never block the form,
 * because the server still decides on save.
 */
export function useUsernameAvailability(
  raw: string,
  ownUsername: string | null,
): AvailabilityState {
  const typed = raw.trim().toLowerCase();
  const debounced = useDebouncedValue(typed, AVAILABILITY_DEBOUNCE_MS);
  const isOwn = typed !== '' && typed === ownUsername?.toLowerCase();

  const query = useQuery({
    queryKey: queryKeys.usernameAvailability(debounced),
    queryFn: ({ signal }) => fetchAvailability(debounced, signal),
    enabled: debounced !== '' && !isOwn,
    staleTime: AVAILABILITY_STALE_MS,
  });

  if (typed === '') return { kind: 'idle' };
  if (isOwn) return { kind: 'available' };
  if (typed !== debounced || query.isFetching) return { kind: 'checking' };
  if (query.isError) return { kind: 'error' };
  if (!query.data) return { kind: 'checking' };
  return query.data.available
    ? { kind: 'available' }
    : { kind: 'unavailable', reason: query.data.reason ?? 'TAKEN' };
}
