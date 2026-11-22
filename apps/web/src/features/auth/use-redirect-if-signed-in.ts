'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/auth-client';

export const SIGNED_IN_HOME = '/home';

/**
 * Sends a signed-in user away from the auth pages. The form renders immediately and is not
 * held back by the session check, so a cold API never blocks a signed-out visitor.
 */
export function useRedirectIfSignedIn(to: string = SIGNED_IN_HOME): void {
  const router = useRouter();
  const { data } = useSession();
  const signedIn = Boolean(data?.user);

  useEffect(() => {
    if (signedIn) router.replace(to);
  }, [signedIn, router, to]);
}
