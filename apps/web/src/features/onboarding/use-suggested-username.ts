'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { queryKeys } from '@/lib/query-keys';
import { AVAILABILITY_STALE_MS, fetchAvailability } from './availability';
import { usernameCandidates } from './suggest-username';

type Account = { name: string; email: string; username: string | null };

/**
 * Looks for a free username derived from the name or email, once on mount, and hands the first
 * available one to `apply`. Any failure ends the search quietly: the field just stays empty.
 */
export function useSuggestedUsername(me: Account, apply: (username: string) => void): void {
  const queryClient = useQueryClient();
  // One search per mount: it uses the account as it was when the step opened.
  const initial = useRef(me);
  const applyRef = useRef(apply);
  applyRef.current = apply;

  useEffect(() => {
    const { name, email, username } = initial.current;
    if (username) return;
    let cancelled = false;

    void (async () => {
      for (const candidate of usernameCandidates(name, email)) {
        try {
          const result = await queryClient.fetchQuery({
            queryKey: queryKeys.usernameAvailability(candidate),
            queryFn: ({ signal }) => fetchAvailability(candidate, signal),
            staleTime: AVAILABILITY_STALE_MS,
          });
          if (cancelled) return;
          if (result.available) {
            applyRef.current(candidate);
            return;
          }
        } catch {
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);
}
