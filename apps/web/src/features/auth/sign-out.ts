import { authClient } from '@/lib/auth-client';

/**
 * Ends the session and leaves with a full page load, not a client-side navigation. After
 * `signOut()` the in-memory session store and the cached `/v1/me` still describe the old user
 * for a moment, so a soft navigation to /sign-in sees "signed in" and bounces back to /home.
 * A fresh load starts with empty client state and only the cleared cookie.
 */
export async function signOutAndLeave(to = '/sign-in'): Promise<void> {
  try {
    await authClient.signOut();
  } finally {
    window.location.assign(to);
  }
}
