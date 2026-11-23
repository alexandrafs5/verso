import 'reflect-metadata';
import { type INestApplication, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { loadAuthEnv } from '../../config/auth-env.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../../infra/email/email.provider.js';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { setupApp } from '../../setup-app.js';
import { AuthEmailService } from './auth-email.service.js';
import { createAuth } from './auth.js';
import { AuthModule } from './auth.module.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';
// This file tests the limiter, so it is on, with the default max of 10.
process.env['AUTH_RATE_LIMIT_ENABLED'] = 'true';
delete process.env['AUTH_RATE_LIMIT_MAX'];

const ORIGIN = 'http://localhost:3000';
const EMAIL_DOMAIN = '@auth-rate-limit.local';
const PASSWORD = 'correct horse battery';
const TEST_SECRET = 'x'.repeat(32);
const LIMIT = 10;

@Module({ imports: [AppModule, AuthModule] })
class RateLimitTestModule {}

let emailCounter = 0;
const uniqueEmail = (): string => `user${Date.now()}-${emailCounter++}${EMAIL_DOMAIN}`;

// The counters live in a process-wide map, so every test uses its own IP.
let ipCounter = 0;
const uniqueIp = (): string => `10.12.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`;

describe('Auth rate limiting (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const mailbox = new InMemoryEmailProvider();

  const post = (path: string, ip: string, body: Record<string, unknown>) =>
    request(server)
      .post(`/api/auth/${path}`)
      .set('Origin', ORIGIN)
      .set('x-forwarded-for', ip)
      .send(body);

  const signIn = (ip: string, email = uniqueEmail()) =>
    post('sign-in/email', ip, { email, password: PASSWORD });
  const signUp = (ip: string, email = uniqueEmail()) =>
    post('sign-up/email', ip, { email, password: PASSWORD, name: 'Test User' });
  const forgotPassword = (ip: string, email = uniqueEmail()) =>
    post('request-password-reset', ip, { email, redirectTo: `${ORIGIN}/reset-password` });
  const resendVerification = (ip: string, email = uniqueEmail()) =>
    post('send-verification-email', ip, { email, callbackURL: ORIGIN });
  const getSession = (ip: string) =>
    request(server).get('/api/auth/get-session').set('x-forwarded-for', ip);

  /** Sends `count` requests one after another and returns their statuses. */
  const statuses = async (count: number, send: () => Promise<{ status: number }>) => {
    const result: number[] = [];
    for (let i = 0; i < count; i++) result.push((await send()).status);
    return result;
  };

  const cleanUsers = () => prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });

  beforeAll(async () => {
    app = await NestFactory.create(RateLimitTestModule, {
      bufferLogs: true,
      logger: false,
      bodyParser: false,
    });
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = app.get(PrismaService);
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

  describe.each([
    ['sign-in', signIn],
    ['sign-up', signUp],
    ['forgot-password', forgotPassword],
    ['resend-verification', resendVerification],
  ] as const)('%s', (_name, send) => {
    it('lets the first 10 requests through and limits the 11th with 429', async () => {
      const ip = uniqueIp();
      const first = await statuses(LIMIT, () => send(ip));
      expect(first).not.toContain(429);
      const res = await send(ip);
      expect(res.status).toBe(429);
    }, 30_000);
  });

  it('sends X-Retry-After on a 429 response', async () => {
    const ip = uniqueIp();
    await statuses(LIMIT, () => signIn(ip));
    const res = await signIn(ip);
    expect(res.status).toBe(429);
    const retryAfter = Number(res.headers['x-retry-after']);
    expect(retryAfter).toBeGreaterThan(0);
    expect(retryAfter).toBeLessThanOrEqual(60);
  });

  it('keeps a separate counter per IP', async () => {
    const limited = uniqueIp();
    const other = uniqueIp();
    await statuses(LIMIT, () => signIn(limited));
    expect((await signIn(limited)).status).toBe(429);
    expect((await signIn(other)).status).not.toBe(429);
  });

  it('does not limit GET /api/auth/get-session', async () => {
    const ip = uniqueIp();
    const result = await statuses(LIMIT + 5, () => getSession(ip));
    expect(result).not.toContain(429);
  });

  it('sends no extra "account exists" email beyond the limit', async () => {
    const ip = uniqueIp();
    const email = uniqueEmail();
    const result = await statuses(LIMIT + 3, () => signUp(ip, email));
    expect(result.slice(0, LIMIT)).not.toContain(429);
    expect(result.slice(LIMIT)).toEqual([429, 429, 429]);
    // The sends are not awaited by the API: wait for the 10 allowed ones, then check no more come.
    await vi.waitFor(() => expect(mailbox.sent.filter((m) => m.to === email)).toHaveLength(LIMIT));
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(mailbox.sent.filter((m) => m.to === email)).toHaveLength(LIMIT);
  });

  it('keeps the sign-up, verify and sign-in flow working with the limit on', async () => {
    const ip = uniqueIp();
    const email = uniqueEmail();
    expect((await signUp(ip, email)).status).toBe(200);
    await vi.waitFor(() => expect(mailbox.sent.some((m) => m.to === email)).toBe(true));
    const mail = mailbox.sent.find((m) => m.to === email);
    const link = new URL(/https?:\/\/\S+/.exec(mail?.text as string)?.[0] as string);
    const verify = await request(server)
      .get(link.pathname + link.search)
      .set('x-forwarded-for', ip);
    expect(verify.status).toBeLessThan(400);
    const res = await post('sign-in/email', ip, { email, password: PASSWORD });
    expect(res.status).toBe(200);
  });

  describe('configuration', () => {
    const handlerSignIn = (auth: ReturnType<typeof createAuth>, ip: string) =>
      auth.handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN, 'x-forwarded-for': ip },
          body: JSON.stringify({ email: uniqueEmail(), password: PASSWORD }),
        }),
      );

    const handlerStatuses = async (auth: ReturnType<typeof createAuth>, count: number) => {
      const ip = uniqueIp();
      const result: number[] = [];
      for (let i = 0; i < count; i++) result.push((await handlerSignIn(auth, ip)).status);
      return result;
    };

    it('with AUTH_RATE_LIMIT_ENABLED=false, 11 requests are not limited', async () => {
      const auth = createAuth(
        prisma,
        loadAuthEnv({ BETTER_AUTH_SECRET: TEST_SECRET, AUTH_RATE_LIMIT_ENABLED: 'false' }),
        new AuthEmailService(mailbox),
      );
      expect(await handlerStatuses(auth, LIMIT + 1)).not.toContain(429);
    });

    it('enables the limit with defaults, also with NODE_ENV=development', async () => {
      const env = loadAuthEnv({ BETTER_AUTH_SECRET: TEST_SECRET, NODE_ENV: 'development' });
      expect(env.AUTH_RATE_LIMIT_ENABLED).toBe(true);
      const auth = createAuth(prisma, env, new AuthEmailService(mailbox));
      const result = await handlerStatuses(auth, LIMIT + 1);
      expect(result.slice(0, LIMIT)).not.toContain(429);
      expect(result[LIMIT]).toBe(429);
    });

    it('honors AUTH_RATE_LIMIT_MAX', async () => {
      const auth = createAuth(
        prisma,
        loadAuthEnv({ BETTER_AUTH_SECRET: TEST_SECRET, AUTH_RATE_LIMIT_MAX: '2' }),
        new AuthEmailService(mailbox),
      );
      const result = await handlerStatuses(auth, 3);
      expect(result[0]).not.toBe(429);
      expect(result[1]).not.toBe(429);
      expect(result[2]).toBe(429);
    });
  });
});
