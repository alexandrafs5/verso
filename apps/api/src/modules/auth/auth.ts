import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { v7 as uuidv7 } from 'uuid';
import type { AuthEnv } from '../../config/auth-env.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { AuthEmailService } from './auth-email.service.js';

const RATE_LIMIT_WINDOW_SECONDS = 60;

/**
 * Paths of the per-path special rules built into better-auth@1.7.27 (api/rate-limiter). Each is
 * overridden with the flat window and max (SPEC 12). Custom rules match the exact path or a
 * wildcard, so prefix rules (`startsWith`) are listed as exact path plus `/*`.
 */
const BUILT_IN_SPECIAL_RULE_PATHS = [
  '/sign-in',
  '/sign-in/*',
  '/sign-up',
  '/sign-up/*',
  '/change-password',
  '/change-email',
  '/request-password-reset',
  '/send-verification-email',
  '/forget-password',
  '/forget-password/*',
  '/email-otp/send-verification-otp',
  '/email-otp/request-password-reset',
];

export function createAuth(prisma: PrismaService, env: AuthEnv, authEmail: AuthEmailService) {
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
  const signInUrl = new URL('/sign-in', env.WEB_ORIGIN).toString();
  const flatRule = { window: RATE_LIMIT_WINDOW_SECONDS, max: env.AUTH_RATE_LIMIT_MAX };

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.WEB_ORIGIN],
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    // Enabled explicitly: the library default is off in development (SPEC 12).
    rateLimit: {
      enabled: env.AUTH_RATE_LIMIT_ENABLED,
      window: RATE_LIMIT_WINDOW_SECONDS,
      max: env.AUTH_RATE_LIMIT_MAX,
      storage: 'memory',
      customRules: {
        ...Object.fromEntries(BUILT_IN_SPECIAL_RULE_PATHS.map((path) => [path, flatRule])),
        // The web calls it on normal navigation.
        '/get-session': false,
      },
    },
    advanced: {
      database: { generateId: () => uuidv7() },
      ipAddress: { ipAddressHeaders: ['x-forwarded-for'] },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      // Google users arrive verified; password users must verify before signing in.
      requireEmailVerification: true,
      // A reset often follows a suspected compromise: end every other session (SPEC 10).
      revokeSessionsOnPasswordReset: true,
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
