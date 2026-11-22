import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { v7 as uuidv7 } from 'uuid';
import type { AuthEnv } from '../../config/auth-env.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthEmailService } from './auth-email.service.js';

export function createAuth(prisma: PrismaService, env: AuthEnv, authEmail: AuthEmailService) {
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const signInUrl = new URL('/sign-in', env.WEB_ORIGIN).toString();

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    advanced: {
      database: { generateId: () => uuidv7() },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Google users arrive verified; password users must verify before signing in.
      requireEmailVerification: true,
      // The hooks do not await the send: awaiting slows the response and leaks account existence.
      sendResetPassword: ({ user, url }, request) => {
        authEmail.sendPasswordReset(user, url, request);
        return Promise.resolve();
      },
      // With verification required, a duplicate sign-up gets the same response as a new one
      // (no account enumeration). This email tells the real owner that the account exists.
      onExistingUserSignUp: ({ user }, request) => {
        authEmail.sendAccountExists(user, signInUrl, request);
        return Promise.resolve();
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      // An unverified sign-in attempt (403) re-sends the verification email.
      sendOnSignIn: true,
      sendVerificationEmail: ({ user, url }, request) => {
        authEmail.sendVerification(user, url, request);
        return Promise.resolve();
      },
    },
    socialProviders: googleEnabled
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID as string,
            clientSecret: env.GOOGLE_CLIENT_SECRET as string,
          },
        }
      : {},
    user: {
      additionalFields: {
        // Read-only for clients: changed only in the database until the admin flow exists.
        role: { type: 'string', defaultValue: 'USER', input: false },
        // Profile and settings (M2.2). Better Auth has no enum type: enums are declared as
        // strings and the database enforces the values. `input: false` blocks writes through
        // /api/auth/*; M2.5 changes them through /v1/me. Defaults live in the database.
        username: { type: 'string', required: false, input: false },
        bio: { type: 'string', required: false, input: false },
        profileVisibility: { type: 'string', required: false, input: false },
        defaultAnnotationVisibility: { type: 'string', required: false, input: false },
        ratingStyle: { type: 'string', required: false, input: false },
        progressStyle: { type: 'string', required: false, input: false },
        locale: { type: 'string', required: false, input: false },
        theme: { type: 'string', required: false, input: false },
        timeZone: { type: 'string', required: false, input: false },
        reminderEnabled: { type: 'boolean', required: false, input: false },
        reminderTime: { type: 'string', required: false, input: false },
        onboardingCompletedAt: { type: 'date', required: false, input: false },
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
