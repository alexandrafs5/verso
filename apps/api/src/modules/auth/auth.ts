import { Logger } from '@nestjs/common';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { v7 as uuidv7 } from 'uuid';
import type { AuthEnv } from '../../config/auth-env.js';
import type { PrismaService } from '../../infra/prisma/prisma.service.js';

const logger = new Logger('Auth');

/**
 * Temporary email hook (M2.1). Logs the recipient and link outside production, sends nothing.
 * M2.3 replaces it with EmailProvider.
 */
function logEmailStub(kind: 'verification' | 'password reset', to: string, url: string, env: AuthEnv): void {
  if (env.NODE_ENV === 'production') return;
  logger.log(`[${kind}] to=${to} url=${url}`);
}

export function createAuth(prisma: PrismaService, env: AuthEnv) {
  const googleEnabled = Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);

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
      sendResetPassword: ({ user, url }) => {
        logEmailStub('password reset', user.email, url, env);
        return Promise.resolve();
      },
    },
    emailVerification: {
      sendVerificationEmail: ({ user, url }) => {
        logEmailStub('verification', user.email, url, env);
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
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
