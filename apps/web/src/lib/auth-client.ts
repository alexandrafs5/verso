import { createAuthClient } from 'better-auth/react';

// The browser only talks to the web origin; next.config rewrites /api/* to the API (SPEC 01).
// Without baseURL the client uses the current origin and the default /api/auth path.
export const authClient = createAuthClient();

export const { signIn, signUp, useSession } = authClient;
