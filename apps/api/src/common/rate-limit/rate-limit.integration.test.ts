import 'reflect-metadata';
import { Controller, Get, type INestApplication, Module, UseGuards } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { problemSchema } from '@verso/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../../infra/email/email.provider.js';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { FILE_STORAGE, type FileStorage } from '../../infra/storage/file-storage.js';
import { InMemoryFileStorage } from '../../infra/storage/in-memory-file-storage.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuthModule, SessionGuard } from '../../modules/auth/index.js';
import { setupApp } from '../../setup-app.js';
import { RATE_LIMITS, RateLimit, RateLimitBucket } from './rate-limit.js';
import { RateLimitModule } from './rate-limit.module.js';
import { UserThrottlerGuard } from './user-throttler.guard.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';
// Many sign-ups from one IP: the auth limiter has its own tests.
process.env['AUTH_RATE_LIMIT_ENABLED'] = 'false';

const ORIGIN = 'http://localhost:3000';
const EMAIL_DOMAIN = '@v1-rate-limit.local';
const PASSWORD = 'correct horse battery';

/** Stand-in for the search endpoints of M3.3: a GET in the search bucket. */
@Controller('v1/test-search')
@UseGuards(SessionGuard, UserThrottlerGuard)
class TestSearchController {
  @Get()
  @RateLimit(RateLimitBucket.SEARCH)
  search(): { ok: true } {
    return { ok: true };
  }
}

@Module({ imports: [AuthModule, RateLimitModule], controllers: [TestSearchController] })
class RateLimitTestModule {}

@Module({ imports: [AppModule, RateLimitTestModule] })
class RootModule {}

let counter = 0;
const uniqueEmail = (): string => `user${Date.now()}-${counter++}${EMAIL_DOMAIN}`;

describe('/v1 rate limiting (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const mailbox = new InMemoryEmailProvider();

  const cookieOf = (res: request.Response): string =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');

  const createSession = async (): Promise<string> => {
    const email = uniqueEmail();
    await request(server)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD, name: 'Test User' });
    await vi.waitFor(() => expect(mailbox.lastTo(email)).toBeDefined());
    const link = new URL(
      /https?:\/\/\S+/.exec(mailbox.lastTo(email)?.text as string)?.[0] as string,
    );
    await request(server).get(link.pathname + link.search);
    const signIn = await request(server)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD });
    return cookieOf(signIn);
  };

  /** Fires `count` sequential requests and returns their statuses. */
  const hit = async (count: number, fire: () => request.Test): Promise<number[]> => {
    const statuses: number[] = [];
    for (let i = 0; i < count; i++) statuses.push((await fire()).status);
    return statuses;
  };

  const cleanUsers = () => prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });

  beforeAll(async () => {
    app = await NestFactory.create(RootModule, {
      bufferLogs: true,
      logger: false,
      bodyParser: false,
    });
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = app.get(PrismaService);
    app.get<EmailProvider>(EMAIL_PROVIDER).send = (message) => mailbox.send(message);
    const storage = new InMemoryFileStorage();
    const realStorage = app.get<FileStorage>(FILE_STORAGE);
    realStorage.createUploadUrl = (path, contentType) => storage.createUploadUrl(path, contentType);
    await cleanUsers();
  });

  afterAll(async () => {
    await cleanUsers();
    await app.close();
  });

  it('answers 401, not 429, for unauthenticated requests', async () => {
    const statuses = await hit(RATE_LIMITS.usernameCheck + 5, () =>
      request(server).get('/api/v1/usernames/someone/availability'),
    );
    expect(new Set(statuses)).toEqual(new Set([401]));
  });

  it('limits username availability to 30/min/user with problem+json and Retry-After', async () => {
    const cookie = await createSession();
    const check = () =>
      request(server).get('/api/v1/usernames/free_name/availability').set('Cookie', cookie);
    expect(new Set(await hit(RATE_LIMITS.usernameCheck, check))).toEqual(new Set([200]));
    const blocked = await check();
    expect(blocked.status).toBe(429);
    expect(problemSchema.parse(blocked.body).code).toBe('RATE_LIMITED');
    expect(blocked.headers['content-type']).toContain('application/problem+json');
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });

  it('counts per user, not per IP', async () => {
    const a = await createSession();
    const b = await createSession();
    const check = (cookie: string) =>
      request(server).get('/api/v1/usernames/free_name/availability').set('Cookie', cookie);
    await hit(RATE_LIMITS.usernameCheck, () => check(a));
    expect((await check(a)).status).toBe(429);
    expect((await check(b)).status).toBe(200);
  });

  it('limits avatar upload URLs to 10/min/user without using up the writes bucket', async () => {
    const cookie = await createSession();
    const upload = () =>
      request(server)
        .post('/api/v1/me/avatar/upload-url')
        .set('Cookie', cookie)
        .set('Origin', ORIGIN)
        .send({ contentType: 'image/webp', size: 1024 });
    expect(new Set(await hit(RATE_LIMITS.avatarUpload, upload))).toEqual(new Set([200]));
    expect((await upload()).status).toBe(429);
    const patch = await request(server)
      .patch('/api/v1/me')
      .set('Cookie', cookie)
      .set('Origin', ORIGIN)
      .send({ bio: 'hello' });
    expect(patch.status).toBe(200);
  });

  it(
    'limits writes to 120/min/user and never limits plain reads',
    { timeout: 60_000 },
    async () => {
      const cookie = await createSession();
      const patch = () =>
        request(server)
          .patch('/api/v1/me')
          .set('Cookie', cookie)
          .set('Origin', ORIGIN)
          .send({ bio: 'x' });
      expect(new Set(await hit(RATE_LIMITS.writes, patch))).toEqual(new Set([200]));
      expect((await patch()).status).toBe(429);
      expect((await request(server).get('/api/v1/me').set('Cookie', cookie)).status).toBe(200);
    },
  );

  it('limits search routes to 60/min/user', async () => {
    const cookie = await createSession();
    const search = () => request(server).get('/api/v1/test-search').set('Cookie', cookie);
    expect(new Set(await hit(RATE_LIMITS.search, search))).toEqual(new Set([200]));
    expect((await search()).status).toBe(429);
  });
});
