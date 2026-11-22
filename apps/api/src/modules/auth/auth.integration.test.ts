import 'reflect-metadata';
import fs from 'node:fs';
import { Controller, Get, type INestApplication, Logger, Module, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ErrorCode, problemSchema } from '@verso/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { loadAuthEnv } from '../../config/auth-env.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../../infra/email/email.provider.js';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { setupApp } from '../../setup-app.js';
import { AdminGuard } from './admin.guard.js';
import { AuthEmailService } from './auth-email.service.js';
import { createAuth } from './auth.js';
import { AuthModule } from './auth.module.js';
import type { AuthUser } from './auth.types.js';
import { CurrentUser } from './current-user.decorator.js';
import { SessionGuard } from './session.guard.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';

const ORIGIN = 'http://localhost:3000';
const EMAIL_DOMAIN = '@auth-test.local';
const PASSWORD = 'correct horse battery';
const TEST_SECRET = 'x'.repeat(32);
const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// Test-only controller: exists only in this test module, never in AppModule.
@Controller('test')
class AuthTestController {
  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthUser) {
    return { id: user.id, email: user.email, role: user.role };
  }

  @Get('profile')
  @UseGuards(SessionGuard)
  profile(@CurrentUser() user: AuthUser) {
    return user;
  }

  @Get('admin')
  @UseGuards(SessionGuard, AdminGuard)
  admin() {
    return { ok: true };
  }
}

@Module({ imports: [AppModule, AuthModule], controllers: [AuthTestController] })
class AuthTestModule {}

let counter = 0;
const uniqueEmail = (): string => `user${Date.now()}-${counter++}${EMAIL_DOMAIN}`;

describe('Better Auth + guards (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];

  // Every email the API sends goes to this fake (see beforeAll).
  const mailbox = new InMemoryEmailProvider();
  const BASE_URL = loadAuthEnv().BETTER_AUTH_URL;

  const signUp = (
    email: string,
    password = PASSWORD,
    extra: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) =>
    request(server)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .set(headers)
      .send({ email, password, name: 'Test User', ...extra });

  const signIn = (email: string, password = PASSWORD) =>
    request(server).post('/api/auth/sign-in/email').set('Origin', ORIGIN).send({ email, password });

  /** The sends are not awaited by the API, so wait until `count` emails reached the address. */
  const emailsTo = async (email: string, count = 1) => {
    await vi.waitFor(() =>
      expect(mailbox.sent.filter((m) => m.to === email).length).toBeGreaterThanOrEqual(count),
    );
    return mailbox.sent.filter((m) => m.to === email);
  };

  const linkIn = (text: string): string => /https?:\/\/\S+/.exec(text)?.[0] as string;

  /** Opens the verification link from the latest email to the address. */
  const verifyEmail = async (email: string) => {
    const emails = await emailsTo(email);
    const link = new URL(linkIn(emails[emails.length - 1]?.text as string));
    const res = await request(server).get(link.pathname + link.search);
    expect(res.status).toBeLessThan(400);
  };

  /** Sign-up, open the verification link, sign in. Returns the session cookie. */
  const signUpAndSignIn = async (email: string): Promise<string> => {
    expect((await signUp(email)).status).toBe(200);
    await verifyEmail(email);
    const res = await signIn(email);
    expect(res.status).toBe(200);
    return cookieOf(res);
  };

  const setCookies = (res: request.Response): string[] =>
    (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];

  const cookieOf = (res: request.Response): string =>
    setCookies(res)
      .map((c) => c.split(';')[0])
      .join('; ');

  const cleanUsers = () => prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });

  beforeAll(async () => {
    app = await NestFactory.create(AuthTestModule, {
      bufferLogs: true,
      logger: false,
      bodyParser: false,
    });
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = app.get(PrismaService);
    // No @nestjs/testing here: route the real provider's send to the in-memory fake.
    const provider = app.get<EmailProvider>(EMAIL_PROVIDER);
    provider.send = (message) => mailbox.send(message);
    await cleanUsers();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    mailbox.clear();
    await cleanUsers();
  });

  afterAll(async () => {
    await cleanUsers();
    await app.close();
  });

  describe('sign-up', () => {
    it('returns 200 with no session and creates an unverified USER with a UUID v7 id', async () => {
      const email = uniqueEmail();
      const res = await signUp(email);
      expect(res.status).toBe(200);
      expect(cookieOf(res)).not.toContain('session_token');
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.id).toMatch(UUID_V7);
      expect(user.role).toBe('USER');
      expect(user.emailVerified).toBe(false);
    });

    it('rejects a password shorter than 8 characters and creates no user', async () => {
      const email = uniqueEmail();
      const res = await signUp(email, 'short');
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.status).toBeLessThan(500);
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('ignores role in the body: role "ADMIN" produces a USER', async () => {
      const email = uniqueEmail();
      await signUp(email, PASSWORD, { role: 'ADMIN' });
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.role).toBe('USER');
    });
  });

  describe('sign-in, session and sign-out', () => {
    it('sign-in with the right password returns an HttpOnly session cookie once verified', async () => {
      const email = uniqueEmail();
      await signUp(email);
      await verifyEmail(email);
      const res = await signIn(email);
      expect(res.status).toBe(200);
      expect(cookieOf(res)).toContain('session_token');
      expect(setCookies(res).join(';')).toMatch(/HttpOnly/i);
    });

    it('sign-in with a wrong password returns 401 and no cookie', async () => {
      const email = uniqueEmail();
      await signUp(email);
      await verifyEmail(email);
      const res = await signIn(email, 'wrong password!');
      expect(res.status).toBe(401);
      expect(res.headers['set-cookie']).toBeUndefined();
    });

    it('get-session returns the user with the cookie and no session without it', async () => {
      const email = uniqueEmail();
      const cookie = await signUpAndSignIn(email);
      const withCookie = await request(server).get('/api/auth/get-session').set('Cookie', cookie);
      expect(withCookie.status).toBe(200);
      expect((withCookie.body as { user: { email: string } }).user.email).toBe(email);
      const without = await request(server).get('/api/auth/get-session');
      expect(without.body).toBeNull();
    });

    it('sign-out invalidates the session: the same cookie then fails SessionGuard', async () => {
      const cookie = await signUpAndSignIn(uniqueEmail());
      expect((await request(server).get('/api/test/me').set('Cookie', cookie)).status).toBe(200);
      const out = await request(server)
        .post('/api/auth/sign-out')
        .set('Origin', ORIGIN)
        .set('Cookie', cookie)
        .send({});
      expect(out.status).toBe(200);
      expect((await request(server).get('/api/test/me').set('Cookie', cookie)).status).toBe(401);
    });
  });

  describe('SessionGuard and @CurrentUser()', () => {
    it('returns 401 problem+json UNAUTHENTICATED without a cookie', async () => {
      const res = await request(server).get('/api/test/me');
      expect(res.status).toBe(401);
      expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(problemSchema.parse(res.body).code).toBe(ErrorCode.UNAUTHENTICATED);
    });

    it('returns 200 with a valid cookie and @CurrentUser() gives id, email and role', async () => {
      const email = uniqueEmail();
      const cookie = await signUpAndSignIn(email);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const res = await request(server).get('/api/test/me').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ id: user.id, email, role: 'USER' });
    });

    it('returns 401 for an expired session', async () => {
      const email = uniqueEmail();
      const cookie = await signUpAndSignIn(email);
      await prisma.session.updateMany({
        where: { user: { email } },
        data: { expiresAt: new Date(Date.now() - 60_000) },
      });
      const res = await request(server).get('/api/test/me').set('Cookie', cookie);
      expect(res.status).toBe(401);
      expect(problemSchema.parse(res.body).code).toBe(ErrorCode.UNAUTHENTICATED);
    });
  });

  describe('user extensions (M2.2)', () => {
    const DEFAULTS = {
      username: null,
      bio: null,
      profileVisibility: 'PUBLIC',
      defaultAnnotationVisibility: 'PRIVATE',
      ratingStyle: 'STARS_HALF',
      progressStyle: 'PAGES',
      locale: 'en',
      theme: 'SYSTEM',
      timeZone: 'UTC',
      reminderEnabled: false,
      reminderTime: null,
      onboardingCompletedAt: null,
    } as const;

    it('a new user gets the defaults in the database and through @CurrentUser()', async () => {
      const email = uniqueEmail();
      const cookie = await signUpAndSignIn(email);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user).toMatchObject(DEFAULTS);

      const res = await request(server).get('/api/test/profile').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject(DEFAULTS);
    });

    it.each([
      ['username', 'hacker'],
      ['profileVisibility', 'PRIVATE'],
      ['defaultAnnotationVisibility', 'PUBLIC'],
      ['ratingStyle', 'HUNDRED'],
      ['theme', 'DARK'],
      ['timeZone', 'Europe/Madrid'],
      ['reminderEnabled', true],
      ['onboardingCompletedAt', '2026-01-01T00:00:00.000Z'],
    ])('rejects %s in the sign-up body and creates no user', async (field, value) => {
      const email = uniqueEmail();
      const res = await signUp(email, PASSWORD, { [field]: value });
      expect(res.status).toBe(400);
      expect((res.body as { code: string }).code).toBe('FIELD_NOT_ALLOWED');
      expect(await prisma.user.count({ where: { email } })).toBe(0);
    });

    it('rejects two usernames that differ only by case (citext unique)', async () => {
      const first = uniqueEmail();
      const second = uniqueEmail();
      await signUp(first);
      await signUp(second);
      await prisma.user.update({ where: { email: first }, data: { username: 'Maria_01' } });
      await expect(
        prisma.user.update({ where: { email: second }, data: { username: 'maria_01' } }),
      ).rejects.toMatchObject({ code: 'P2002' });
    });
  });

  describe('AdminGuard', () => {
    it('returns 401 without a session', async () => {
      expect((await request(server).get('/api/test/admin')).status).toBe(401);
    });

    it('returns 403 problem+json FORBIDDEN for a USER and 200 for an ADMIN', async () => {
      const email = uniqueEmail();
      const cookie = await signUpAndSignIn(email);
      const forbidden = await request(server).get('/api/test/admin').set('Cookie', cookie);
      expect(forbidden.status).toBe(403);
      expect(forbidden.headers['content-type']).toMatch(/^application\/problem\+json/);
      expect(problemSchema.parse(forbidden.body).code).toBe(ErrorCode.FORBIDDEN);

      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
      const ok = await request(server).get('/api/test/admin').set('Cookie', cookie);
      expect(ok.status).toBe(200);
    });
  });

  describe('Google provider', () => {
    const socialSignIn = (auth: ReturnType<typeof createAuth>) =>
      auth.handler(
        new Request(`${ORIGIN}/api/auth/sign-in/social`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({ provider: 'google', callbackURL: '/' }),
        }),
      );

    it('fails with a provider-not-found error when the Google vars are unset', async () => {
      const auth = createAuth(
        prisma,
        loadAuthEnv({ BETTER_AUTH_SECRET: TEST_SECRET }),
        new AuthEmailService(mailbox),
      );
      const res = await socialSignIn(auth);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(await res.json())).toMatch(/provider/i);
    });

    it('returns a redirect URL to Google when both vars are set', async () => {
      const auth = createAuth(
        prisma,
        loadAuthEnv({
          BETTER_AUTH_SECRET: TEST_SECRET,
          GOOGLE_CLIENT_ID: 'dummy-id',
          GOOGLE_CLIENT_SECRET: 'dummy-secret',
        }),
        new AuthEmailService(mailbox),
      );
      const res = await socialSignIn(auth);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { url: string };
      expect(body.url).toMatch(/^https:\/\/accounts\.google\.com\//);
    });
  });

  describe('auth emails (M2.3)', () => {
    const resetRequest = (email: string, headers: Record<string, string> = {}) =>
      request(server)
        .post('/api/auth/request-password-reset')
        .set('Origin', ORIGIN)
        .set(headers)
        .send({ email, redirectTo: `${ORIGIN}/reset-password` });

    it('sends the verification email in English without Accept-Language', async () => {
      const email = uniqueEmail();
      await signUp(email);
      const [message] = await emailsTo(email);
      expect(message?.html).toContain('lang="en"');
      expect(message?.subject).toBe('Verify your email address');
      expect(linkIn(message?.text as string)).toMatch(new RegExp(`^${BASE_URL}`));
    });

    it('sends the verification email in Spanish with Accept-Language: es', async () => {
      const email = uniqueEmail();
      await signUp(email, PASSWORD, {}, { 'Accept-Language': 'es-ES,es;q=0.9' });
      const [message] = await emailsTo(email);
      expect(message?.html).toContain('lang="es"');
      expect(message?.subject).toBe('Verifica tu correo electrónico');
    });

    it('sends one password-reset email in the user locale with a link under BETTER_AUTH_URL', async () => {
      const email = uniqueEmail();
      await signUp(email);
      await verifyEmail(email);
      await prisma.user.update({ where: { email }, data: { locale: 'es' } });
      mailbox.clear();

      expect((await resetRequest(email)).status).toBe(200);
      const messages = await emailsTo(email);
      expect(messages).toHaveLength(1);
      expect(messages[0]?.html).toContain('lang="es"');
      expect(messages[0]?.subject).toBe('Restablece tu contraseña');
      expect(linkIn(messages[0]?.text as string)).toMatch(new RegExp(`^${BASE_URL}`));
    });

    it('prefers Accept-Language over the user locale for the reset email', async () => {
      const email = uniqueEmail();
      await signUp(email);
      await verifyEmail(email);
      mailbox.clear();

      await resetRequest(email, { 'Accept-Language': 'es' });
      const [message] = await emailsTo(email);
      expect(message?.html).toContain('lang="es"');
    });

    it('sends no email for a password-reset request with an unknown address', async () => {
      const res = await resetRequest(uniqueEmail());
      expect(res.status).toBe(200);
      await new Promise((resolve) => setTimeout(resolve, 200));
      expect(mailbox.sent).toHaveLength(0);
    });

    it('rejects sign-in before verification with 403 and sends a new verification email', async () => {
      const email = uniqueEmail();
      await signUp(email);
      await emailsTo(email, 1);

      const res = await signIn(email);
      expect(res.status).toBe(403);
      expect(res.headers['set-cookie']).toBeUndefined();
      expect(await emailsTo(email, 2)).toHaveLength(2);
    });

    it('lets the user sign in after opening the verification link', async () => {
      const email = uniqueEmail();
      await signUp(email);
      expect((await signIn(email)).status).toBe(403);
      await verifyEmail(email);
      const res = await signIn(email);
      expect(res.status).toBe(200);
      expect(cookieOf(res)).toContain('session_token');
    });

    it('still signs the user up when the provider rejects, and logs no address or URL', async () => {
      const email = uniqueEmail();
      mailbox.failWith = new Error(`rejected ${email}`);
      const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const res = await signUp(email);
      expect(res.status).toBe(200);
      expect(await prisma.user.count({ where: { email } })).toBe(1);

      await vi.waitFor(() => expect(error).toHaveBeenCalled());
      const lines = error.mock.calls.map((call) => String(call[0]));
      for (const line of lines) {
        expect(line).not.toContain(email);
        expect(line).not.toMatch(/https?:\/\//);
      }
    });

    it('never logs a verification or reset URL at info level or above', async () => {
      const lines: string[] = [];
      for (const level of ['log', 'warn', 'error', 'fatal'] as const) {
        vi.spyOn(Logger.prototype, level).mockImplementation((message: unknown) => {
          lines.push(String(message));
        });
      }
      // pino request logs bypass process.stdout (sonic-boom calls fs.write / fs.writeSync):
      // record what goes to fd 1 and still let it through.
      for (const method of ['write', 'writeSync'] as const) {
        const real = fs[method] as (...args: unknown[]) => unknown;
        vi.spyOn(fs, method).mockImplementation(((...args: unknown[]) => {
          if (args[0] === 1) lines.push(String(args[1]));
          return real(...args);
        }) as never);
      }
      const email = uniqueEmail();
      await signUpAndSignIn(email); // clicks the verification link
      const verificationToken = new URL(
        linkIn((await emailsTo(email))[0]?.text as string),
      ).searchParams.get('token') as string;

      await resetRequest(email);
      const reset = (await emailsTo(email, 2))[1];
      const resetLink = new URL(linkIn(reset?.text as string));
      await request(server).get(resetLink.pathname + resetLink.search); // clicks the reset link
      const resetToken = resetLink.pathname.split('/').pop() as string;

      const logged = lines.join('\n');
      expect(logged).toContain('request completed'); // the capture works
      expect(logged).not.toContain(verificationToken);
      expect(logged).not.toContain(resetToken);
      expect(logged).not.toMatch(/token=/);
    });
  });

  describe('env validation', () => {
    it('loadAuthEnv throws a clear error when BETTER_AUTH_SECRET is missing', () => {
      expect(() => loadAuthEnv({})).toThrow(/BETTER_AUTH_SECRET/);
    });

    it('the app fails to boot in production without BREVO_API_KEY', async () => {
      const saved = {
        NODE_ENV: process.env['NODE_ENV'],
        BREVO_API_KEY: process.env['BREVO_API_KEY'],
      };
      process.env['NODE_ENV'] = 'production';
      delete process.env['BREVO_API_KEY'];
      try {
        await expect(
          NestFactory.create(AuthTestModule, {
            logger: false,
            bodyParser: false,
            abortOnError: false,
          }),
        ).rejects.toThrow(/BREVO_API_KEY is required/);
      } finally {
        for (const [key, value] of Object.entries(saved)) {
          if (value === undefined) delete process.env[key];
          else process.env[key] = value;
        }
      }
    });

    it('the app fails to boot when BETTER_AUTH_SECRET is missing', async () => {
      const saved = process.env['BETTER_AUTH_SECRET'];
      delete process.env['BETTER_AUTH_SECRET'];
      try {
        await expect(
          NestFactory.create(AuthTestModule, {
            logger: false,
            bodyParser: false,
            abortOnError: false,
          }),
        ).rejects.toThrow(/BETTER_AUTH_SECRET/);
      } finally {
        process.env['BETTER_AUTH_SECRET'] = saved;
      }
    });
  });
});
