import 'reflect-metadata';
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { meSchema, problemSchema, signedUploadSchema } from '@verso/shared';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../../infra/email/email.provider.js';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { FILE_STORAGE, type FileStorage } from '../../infra/storage/file-storage.js';
import { InMemoryFileStorage } from '../../infra/storage/in-memory-file-storage.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { setupApp } from '../../setup-app.js';
import { GoalPolicy } from './domain/goal-policy.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';

const ORIGIN = 'http://localhost:3000';
const EMAIL_DOMAIN = '@users-test.local';
const PASSWORD = 'correct horse battery';

let counter = 0;
const uniqueEmail = (): string => `user${Date.now()}-${counter++}${EMAIL_DOMAIN}`;
const uniqueUsername = (): string => `t${Date.now().toString(36)}${counter++}`;

describe('Users module: /v1/me endpoints (integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const mailbox = new InMemoryEmailProvider();
  const storage = new InMemoryFileStorage();

  const cookieOf = (res: request.Response): string =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');

  /** Sign-up, open the verification link, sign in. Returns the session cookie. */
  const createSession = async (): Promise<{ cookie: string; email: string }> => {
    const email = uniqueEmail();
    const signUp = await request(server)
      .post('/api/auth/sign-up/email')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD, name: 'Test User' });
    expect(signUp.status).toBe(200);
    await vi.waitFor(() => expect(mailbox.lastTo(email)).toBeDefined());
    const link = new URL(
      /https?:\/\/\S+/.exec(mailbox.lastTo(email)?.text as string)?.[0] as string,
    );
    expect((await request(server).get(link.pathname + link.search)).status).toBeLessThan(400);
    const signIn = await request(server)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD });
    expect(signIn.status).toBe(200);
    return { cookie: cookieOf(signIn), email };
  };

  const get = (path: string, cookie?: string) => {
    const req = request(server).get(`/api${path}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };
  const send = (method: 'patch' | 'put' | 'post', path: string, cookie?: string) => {
    const req = request(server)[method](`/api${path}`);
    return cookie ? req.set('Cookie', cookie) : req;
  };

  const cleanUsers = () => prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });

  beforeAll(async () => {
    app = await NestFactory.create(AppModule, {
      bufferLogs: true,
      logger: false,
      bodyParser: false,
    });
    setupApp(app);
    await app.init();
    server = app.getHttpServer() as Parameters<typeof request>[0];
    prisma = app.get(PrismaService);
    app.get<EmailProvider>(EMAIL_PROVIDER).send = (message) => mailbox.send(message);
    // Route the real storage (Supabase or unconfigured) to the in-memory fake.
    const realStorage = app.get<FileStorage>(FILE_STORAGE);
    realStorage.createUploadUrl = (path, contentType) => storage.createUploadUrl(path, contentType);
    realStorage.delete = (path) => storage.delete(path);
    realStorage.publicUrl = (path) => storage.publicUrl(path);
    await cleanUsers();
  });

  afterEach(async () => {
    mailbox.clear();
    storage.clear();
    await cleanUsers();
  });

  afterAll(async () => {
    await cleanUsers();
    await app.close();
  });

  describe('GET /v1/me', () => {
    it('returns 401 without a session', async () => {
      const res = await get('/v1/me');
      expect(res.status).toBe(401);
      expect(problemSchema.parse(res.body).code).toBe('UNAUTHENTICATED');
    });

    it('returns the user, settings and onboarding state', async () => {
      const { cookie, email } = await createSession();
      const res = await get('/v1/me', cookie);
      expect(res.status).toBe(200);
      const me = meSchema.parse(res.body);
      expect(me.email).toBe(email);
      expect(me.username).toBeNull();
      expect(me.onboardingCompletedAt).toBeNull();
      expect(me.settings).toMatchObject({
        ratingStyle: 'STARS_HALF',
        locale: 'en',
        theme: 'SYSTEM',
      });
    });

    it('never exposes reminder fields', async () => {
      const { cookie } = await createSession();
      const res = await get('/v1/me', cookie);
      expect(JSON.stringify(res.body)).not.toContain('reminder');
    });
  });

  describe('PATCH /v1/me', () => {
    it('returns 401 without a session', async () => {
      expect((await send('patch', '/v1/me').send({ name: 'X' })).status).toBe(401);
    });

    it('updates name and bio, and clears the bio with null', async () => {
      const { cookie } = await createSession();
      const res = await send('patch', '/v1/me', cookie).send({ name: ' Ana ', bio: 'Reader' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ name: 'Ana', bio: 'Reader' });
      const cleared = await send('patch', '/v1/me', cookie).send({ bio: null });
      expect(cleared.body.bio).toBeNull();
    });

    it('rejects an invalid body with 400 VALIDATION_ERROR', async () => {
      const { cookie } = await createSession();
      const res = await send('patch', '/v1/me', cookie).send({ name: '   ' });
      expect(res.status).toBe(400);
      expect(problemSchema.parse(res.body).code).toBe('VALIDATION_ERROR');
    });

    it('stores a mixed-case valid username lowercased', async () => {
      const { cookie } = await createSession();
      const name = uniqueUsername();
      const res = await send('patch', '/v1/me', cookie).send({ username: name.toUpperCase() });
      expect(res.status).toBe(200);
      expect(res.body.username).toBe(name);
    });

    it('returns 409 USERNAME_TAKEN when another user owns it, in any case', async () => {
      const a = await createSession();
      const b = await createSession();
      const name = uniqueUsername();
      expect((await send('patch', '/v1/me', a.cookie).send({ username: name })).status).toBe(200);
      const res = await send('patch', '/v1/me', b.cookie).send({ username: name.toUpperCase() });
      expect(res.status).toBe(409);
      expect(problemSchema.parse(res.body).code).toBe('USERNAME_TAKEN');
    });

    it('lets a user save their own current username again', async () => {
      const { cookie } = await createSession();
      const name = uniqueUsername();
      await send('patch', '/v1/me', cookie).send({ username: name });
      const res = await send('patch', '/v1/me', cookie).send({ username: name });
      expect(res.status).toBe(200);
    });

    it.each([
      ['reserved', 'admin', 'RESERVED'],
      ['too short', 'ab', 'TOO_SHORT'],
      ['too long', 'a'.repeat(21), 'TOO_LONG'],
      ['malformed', 'bad name!', 'INVALID_CHARACTERS'],
    ])('returns 400 USERNAME_INVALID for a %s username', async (_label, username, reason) => {
      const { cookie } = await createSession();
      const res = await send('patch', '/v1/me', cookie).send({ username });
      expect(res.status).toBe(400);
      const problem = problemSchema.parse(res.body);
      expect(problem.code).toBe('USERNAME_INVALID');
      expect(problem.detail).toBe(reason);
    });

    it("only changes the session user's row", async () => {
      const a = await createSession();
      const b = await createSession();
      await send('patch', '/v1/me', b.cookie).send({ name: 'Bea', bio: 'B bio' });
      const me = await get('/v1/me', a.cookie);
      expect(me.body).toMatchObject({ name: 'Test User', bio: null });
    });
  });

  describe('POST /v1/me/avatar/upload-url', () => {
    const valid = { contentType: 'image/webp', size: 1024 };

    it('returns 401 without a session', async () => {
      expect((await send('post', '/v1/me/avatar/upload-url').send(valid)).status).toBe(401);
    });

    it('returns a signed upload for a path under avatars/{userId}/', async () => {
      const { cookie, email } = await createSession();
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const res = await send('post', '/v1/me/avatar/upload-url', cookie).send(valid);
      expect(res.status).toBe(200);
      const upload = signedUploadSchema.parse(res.body);
      expect(upload.path).toMatch(new RegExp(`^avatars/${user.id}/[0-9a-f-]{36}\\.webp$`));
      expect(storage.uploadRequests).toEqual([{ path: upload.path, contentType: 'image/webp' }]);
    });

    it('rejects another content type or a size over 2 MB with 400', async () => {
      const { cookie } = await createSession();
      const png = await send('post', '/v1/me/avatar/upload-url', cookie).send({
        ...valid,
        contentType: 'image/png',
      });
      expect(png.status).toBe(400);
      const big = await send('post', '/v1/me/avatar/upload-url', cookie).send({
        ...valid,
        size: 2 * 1024 * 1024 + 1,
      });
      expect(big.status).toBe(400);
      expect(storage.uploadRequests).toHaveLength(0);
    });

    it('returns 503 STORAGE_UNAVAILABLE when storage fails', async () => {
      const { cookie } = await createSession();
      storage.failWith = new Error('supabase down');
      const res = await send('post', '/v1/me/avatar/upload-url', cookie).send(valid);
      expect(res.status).toBe(503);
      expect(problemSchema.parse(res.body).code).toBe('STORAGE_UNAVAILABLE');
    });
  });

  describe('PATCH /v1/me avatar', () => {
    const userIdOf = async (email: string) =>
      (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    it('stores the public url for a path under the own folder', async () => {
      const { cookie, email } = await createSession();
      const path = `avatars/${await userIdOf(email)}/${randomUUID()}.webp`;
      const res = await send('patch', '/v1/me', cookie).send({ avatarPath: path });
      expect(res.status).toBe(200);
      expect(res.body.image).toBe(storage.publicUrl(path));
      expect(storage.deleted).toEqual([]);
    });

    it("returns 403 for a path under another user's folder and changes nothing", async () => {
      const a = await createSession();
      const b = await createSession();
      const path = `avatars/${await userIdOf(b.email)}/${randomUUID()}.webp`;
      const res = await send('patch', '/v1/me', a.cookie).send({ avatarPath: path });
      expect(res.status).toBe(403);
      expect(problemSchema.parse(res.body).code).toBe('FORBIDDEN');
      expect((await get('/v1/me', a.cookie)).body.image).toBeNull();
    });

    it('returns 403 for traversal and non-avatar paths', async () => {
      const { cookie, email } = await createSession();
      const id = await userIdOf(email);
      for (const avatarPath of [
        `avatars/${id}/../x.webp`,
        `covers/${id}/x.webp`,
        `avatars/${id}/x.png`,
      ]) {
        const res = await send('patch', '/v1/me', cookie).send({ avatarPath });
        expect(res.status).toBe(403);
      }
    });

    it('deletes the previous object when the avatar is replaced', async () => {
      const { cookie, email } = await createSession();
      const id = await userIdOf(email);
      const first = `avatars/${id}/${randomUUID()}.webp`;
      const second = `avatars/${id}/${randomUUID()}.webp`;
      await send('patch', '/v1/me', cookie).send({ avatarPath: first });
      const res = await send('patch', '/v1/me', cookie).send({ avatarPath: second });
      expect(res.body.image).toBe(storage.publicUrl(second));
      expect(storage.deleted).toEqual([first]);
    });

    it('deletes the object and clears the image on removeAvatar', async () => {
      const { cookie, email } = await createSession();
      const path = `avatars/${await userIdOf(email)}/${randomUUID()}.webp`;
      await send('patch', '/v1/me', cookie).send({ avatarPath: path });
      const res = await send('patch', '/v1/me', cookie).send({ removeAvatar: true });
      expect(res.status).toBe(200);
      expect(res.body.image).toBeNull();
      expect(storage.deleted).toEqual([path]);
    });

    it('does not delete an image that is not ours (e.g. a Google avatar)', async () => {
      const { cookie, email } = await createSession();
      await prisma.user.update({
        where: { email },
        data: { image: 'https://lh3.googleusercontent.com/a/x' },
      });
      const res = await send('patch', '/v1/me', cookie).send({ removeAvatar: true });
      expect(res.body.image).toBeNull();
      expect(storage.deleted).toEqual([]);
    });

    it('still saves when deleting the old object fails', async () => {
      const { cookie, email } = await createSession();
      const first = `avatars/${await userIdOf(email)}/${randomUUID()}.webp`;
      await send('patch', '/v1/me', cookie).send({ avatarPath: first });
      storage.failWith = new Error('supabase down');
      const res = await send('patch', '/v1/me', cookie).send({ removeAvatar: true });
      expect(res.status).toBe(200);
      expect(res.body.image).toBeNull();
    });

    it('rejects avatarPath together with removeAvatar with 400', async () => {
      const { cookie, email } = await createSession();
      const path = `avatars/${await userIdOf(email)}/${randomUUID()}.webp`;
      const res = await send('patch', '/v1/me', cookie).send({
        avatarPath: path,
        removeAvatar: true,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /v1/me/settings', () => {
    it('returns 401 without a session', async () => {
      expect((await send('patch', '/v1/me/settings').send({ theme: 'DARK' })).status).toBe(401);
    });

    it('stores valid values and returns the updated user', async () => {
      const { cookie } = await createSession();
      const body = {
        ratingStyle: 'HUNDRED',
        progressStyle: 'PERCENT',
        profileVisibility: 'PRIVATE',
        defaultAnnotationVisibility: 'PUBLIC',
        locale: 'es',
        theme: 'DARK',
        timeZone: 'Europe/Madrid',
      };
      const res = await send('patch', '/v1/me/settings', cookie).send(body);
      expect(res.status).toBe(200);
      expect(res.body.settings).toEqual(body);
      expect((await get('/v1/me', cookie)).body.settings).toEqual(body);
    });

    it('rejects reminder fields with 400 and stores nothing', async () => {
      const { cookie, email } = await createSession();
      const res = await send('patch', '/v1/me/settings', cookie).send({ reminderEnabled: true });
      expect(res.status).toBe(400);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.reminderEnabled).toBe(false);
    });

    it('rejects invalid enum values with 400', async () => {
      const { cookie } = await createSession();
      expect((await send('patch', '/v1/me/settings', cookie).send({ theme: 'NEON' })).status).toBe(
        400,
      );
      expect((await send('patch', '/v1/me/settings', cookie).send({ locale: 'fr' })).status).toBe(
        400,
      );
    });

    it('rejects an invalid time zone with 400', async () => {
      const { cookie } = await createSession();
      const res = await send('patch', '/v1/me/settings', cookie).send({ timeZone: 'Mars/Olympus' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /v1/usernames/{username}/availability', () => {
    it('returns 401 without a session', async () => {
      expect((await get('/v1/usernames/someone/availability')).status).toBe(401);
    });

    it('reports TAKEN for another user and available for the caller own username', async () => {
      const a = await createSession();
      const b = await createSession();
      const name = uniqueUsername();
      await send('patch', '/v1/me', a.cookie).send({ username: name });

      const forB = await get(`/v1/usernames/${name}/availability`, b.cookie);
      expect(forB.status).toBe(200);
      expect(forB.body).toEqual({ available: false, reason: 'TAKEN' });
      const forA = await get(`/v1/usernames/${name.toUpperCase()}/availability`, a.cookie);
      expect(forA.body).toEqual({ available: true });
    });

    it('reports available for a free valid username', async () => {
      const { cookie } = await createSession();
      const res = await get(`/v1/usernames/${uniqueUsername()}/availability`, cookie);
      expect(res.body).toEqual({ available: true });
    });

    it('reports the policy reason for an invalid username', async () => {
      const { cookie } = await createSession();
      expect((await get('/v1/usernames/admin/availability', cookie)).body).toEqual({
        available: false,
        reason: 'RESERVED',
      });
      expect((await get('/v1/usernames/ab/availability', cookie)).body).toEqual({
        available: false,
        reason: 'TOO_SHORT',
      });
      expect((await get('/v1/usernames/bad-name/availability', cookie)).body).toEqual({
        available: false,
        reason: 'INVALID_CHARACTERS',
      });
    });
  });

  describe('PUT /v1/me/goals/{year}', () => {
    const year = GoalPolicy.currentYear('UTC');

    it('returns 401 without a session', async () => {
      expect((await send('put', `/v1/me/goals/${year}`).send({ targetBooks: 10 })).status).toBe(
        401,
      );
    });

    it('creates the goal, and a second call updates the same row', async () => {
      const { cookie, email } = await createSession();
      const first = await send('put', `/v1/me/goals/${year}`, cookie).send({ targetBooks: 12 });
      expect(first.status).toBe(200);
      expect(first.body).toEqual({ year, targetBooks: 12 });
      const second = await send('put', `/v1/me/goals/${year}`, cookie).send({ targetBooks: 20 });
      expect(second.body).toEqual({ year, targetBooks: 20 });

      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      const rows = await prisma.yearlyGoal.findMany({ where: { userId: user.id } });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.targetBooks).toBe(20);
    });

    it('accepts next year', async () => {
      const { cookie } = await createSession();
      const res = await send('put', `/v1/me/goals/${year + 1}`, cookie).send({ targetBooks: 5 });
      expect(res.status).toBe(200);
    });

    it('rejects a year outside current and next with 400', async () => {
      const { cookie } = await createSession();
      for (const bad of [year - 1, year + 2]) {
        const res = await send('put', `/v1/me/goals/${bad}`, cookie).send({ targetBooks: 5 });
        expect(res.status).toBe(400);
        expect(problemSchema.parse(res.body).code).toBe('GOAL_YEAR_INVALID');
      }
      expect((await send('put', '/v1/me/goals/abc', cookie).send({ targetBooks: 5 })).status).toBe(
        400,
      );
    });

    it('rejects an invalid targetBooks with 400', async () => {
      const { cookie } = await createSession();
      for (const targetBooks of [0, 1000, 2.5, '10']) {
        const res = await send('put', `/v1/me/goals/${year}`, cookie).send({ targetBooks });
        expect(res.status).toBe(400);
      }
    });

    it('keeps goals per user', async () => {
      const a = await createSession();
      const b = await createSession();
      await send('put', `/v1/me/goals/${year}`, a.cookie).send({ targetBooks: 10 });
      await send('put', `/v1/me/goals/${year}`, b.cookie).send({ targetBooks: 30 });
      const rows = await prisma.yearlyGoal.findMany({
        where: { user: { email: { endsWith: EMAIL_DOMAIN } } },
        orderBy: { targetBooks: 'asc' },
      });
      expect(rows.map((r) => r.targetBooks)).toEqual([10, 30]);
    });
  });

  describe('POST /v1/me/onboarding/complete', () => {
    it('returns 401 without a session', async () => {
      expect((await send('post', '/v1/me/onboarding/complete')).status).toBe(401);
    });

    it('returns 409 USERNAME_REQUIRED without a username and sets nothing', async () => {
      const { cookie, email } = await createSession();
      const res = await send('post', '/v1/me/onboarding/complete', cookie);
      expect(res.status).toBe(409);
      expect(problemSchema.parse(res.body).code).toBe('USERNAME_REQUIRED');
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(user.onboardingCompletedAt).toBeNull();
    });

    it('sets onboardingCompletedAt, and a second call keeps the first timestamp', async () => {
      const { cookie } = await createSession();
      await send('patch', '/v1/me', cookie).send({ username: uniqueUsername() });

      const first = await send('post', '/v1/me/onboarding/complete', cookie);
      expect(first.status).toBe(200);
      const completedAt = meSchema.parse(first.body).onboardingCompletedAt;
      expect(completedAt).not.toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 20));
      const second = await send('post', '/v1/me/onboarding/complete', cookie);
      expect(second.status).toBe(200);
      expect(second.body.onboardingCompletedAt).toBe(completedAt);
      expect((await get('/v1/me', cookie)).body.onboardingCompletedAt).toBe(completedAt);
    });

    it("does not complete another user's onboarding", async () => {
      const a = await createSession();
      const b = await createSession();
      await send('patch', '/v1/me', b.cookie).send({ username: uniqueUsername() });
      await send('post', '/v1/me/onboarding/complete', b.cookie);
      expect((await get('/v1/me', a.cookie)).body.onboardingCompletedAt).toBeNull();
    });
  });
});
