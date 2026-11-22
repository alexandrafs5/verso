import { createAuthClient } from 'better-auth/react';
import { inferAdditionalFields } from 'better-auth/client/plugins';

// The browser only talks to the web origin; next.config rewrites /api/* to the API (SPEC 01).
// Without baseURL the client uses the current origin and the default /api/auth path.
// The additional fields mirror the server config in apps/api (auth.ts); only the ones the web
// reads are declared. Importing the server type would couple the two apps.
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        username: { type: 'string', required: false },
        role: { type: 'string', required: false },
      },
    }),
  ],
});

export const { signIn, signUp, useSession } = authClient;
