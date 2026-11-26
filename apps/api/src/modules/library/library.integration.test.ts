import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { addToLibraryResponseSchema, problemSchema, workDetailSchema } from '@verso/shared';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { CATALOG_PROVIDER, type CatalogProvider } from '../../infra/catalog/catalog-provider.js';
import { InMemoryCatalogProvider } from '../../infra/catalog/in-memory-catalog.provider.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../../infra/email/email.provider.js';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { localToday } from '../reading/domain/local-date.js';
import { ReadingRepository } from '../reading/reading.repository.js';
import { setupApp } from '../../setup-app.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';
process.env['AUTH_RATE_LIMIT_ENABLED'] = 'false';

const ORIGIN = 'http://localhost:3000';
const EMAIL_DOMAIN = '@library-test.local';
const PASSWORD = 'correct horse battery';
const TAG = `lb${Date.now().toString(36)}`;
// Open Library keys no other test file uses, because the columns are unique across the database.
const SEED = `${Date.now()}5`;

let counter = 0;
const uniqueEmail = (): string => `user${Date.now()}-${counter++}${EMAIL_DOMAIN}`;
const uniqueKey = (suffix: 'W' | 'M') => `OL${SEED}${counter++}${suffix}`;

describe('POST /v1/library (HTTP, real Postgres, fake provider)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const mailbox = new InMemoryEmailProvider();
  const fake = new InMemoryCatalogProvider();

  const cookieOf = (res: request.Response): string =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');

  const createSession = async (timeZone = 'UTC'): Promise<{ cookie: string; id: string }> => {
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
    const user = await prisma.user.update({ where: { email }, data: { timeZone } });
    const signIn = await request(server)
      .post('/api/auth/sign-in/email')
      .set('Origin', ORIGIN)
      .send({ email, password: PASSWORD });
    return { cookie: cookieOf(signIn), id: user.id };
  };

  const post = (cookie: string, body: object) =>
    request(server).post('/api/v1/library').set('Origin', ORIGIN).set('Cookie', cookie).send(body);

  /** An Open Library work the fake knows, with one edition. */
  const olWork = () => {
    const key = uniqueKey('W');
    const editionKey = uniqueKey('M');
    fake
      .addWork({
        olWorkKey: key,
        title: `${TAG} work`,
        subtitle: null,
        description: null,
        firstPublishYear: 1955,
        coverUrl: null,
        authorKeys: [],
        subjects: ['Fiction'],
      })
      .addEdition({
        olEditionKey: editionKey,
        olWorkKey: key,
        title: `${TAG} edition`,
        isbn10: null,
        isbn13: null,
        publisher: null,
        publishYear: 1955,
        language: 'es',
        pageCount: 124,
        format: 'PAPERBACK',
        coverUrl: null,
        translatedFrom: null,
      });
    return { key, ref: `ol:${key}`, editionRef: `ol:${editionKey}` };
  };

  const booksOf = (userId: string) =>
    prisma.userBook.findMany({
      where: { userId },
      include: { readings: { orderBy: { number: 'asc' } } },
    });
  const day = (date: Date | null | undefined) => date?.toISOString().slice(0, 10) ?? null;

  const expectProblem = (res: request.Response, status: number, code: string) => {
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(problemSchema.parse(res.body).code).toBe(code);
  };

  // Users first: their cascade removes the library rows that block deleting works.
  const clean = async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
  };

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
    // No test hits Open Library: route every provider call to the fake.
    const provider = app.get<CatalogProvider>(CATALOG_PROVIDER);
    provider.searchWorks = (q, page) => fake.searchWorks(q, page);
    provider.getWork = (key) => fake.getWork(key);
    provider.listEditions = (key, opts) => fake.listEditions(key, opts);
    provider.getEditionByIsbn = (isbn) => fake.getEditionByIsbn(isbn);
    provider.getAuthor = (key) => fake.getAuthor(key);
    await clean();
  });

  afterEach(() => {
    fake.unavailable = false;
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    await clean();
    await app.close();
  });

  it('answers 401 without a session and writes nothing', async () => {
    const { key, ref } = olWork();
    expectProblem(await post('', { workRef: ref, status: 'READ' }), 401, 'UNAUTHENTICATED');
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(0);
  });

  it('answers 403 without the web origin', async () => {
    const { cookie } = await createSession();
    const res = await request(server)
      .post('/api/v1/library')
      .set('Cookie', cookie)
      .send({ workRef: olWork().ref, status: 'READ' });
    expectProblem(res, 403, 'ORIGIN_NOT_ALLOWED');
  });

  it('adds an Open Library work and shows it in the catalog responses', async () => {
    const { cookie, id } = await createSession();
    const { ref, editionRef } = olWork();

    const res = await post(cookie, { workRef: ref, status: 'WANT_TO_READ' });

    expect(res.status).toBe(201);
    const body = addToLibraryResponseSchema.parse(res.body);
    expect(body).toMatchObject({ status: 'WANT_TO_READ', readCount: 0, editionRef });
    const [book] = await booksOf(id);
    expect(book).toMatchObject({ id: body.userBookId, workId: body.workRef, readings: [] });

    const work = await request(server).get(`/api/v1/works/${ref}`).set('Cookie', cookie);
    const { workRef, ...status } = body;
    expect(workDetailSchema.parse(work.body)).toMatchObject({
      ref: workRef,
      libraryStatus: status,
    });
  });

  it('records a finished reading with its dates for Read', async () => {
    const { cookie, id } = await createSession();
    const res = await post(cookie, {
      workRef: olWork().ref,
      status: 'READ',
      startedOn: '2025-01-02',
      finishedOn: '2025-02-10',
    });

    expect(res.body).toMatchObject({ status: 'READ', readCount: 1 });
    const [book] = await booksOf(id);
    expect(book?.readings).toHaveLength(1);
    expect(book?.readings[0]?.state).toBe('FINISHED');
    expect(day(book?.readings[0]?.startedOn)).toBe('2025-01-02');
    expect(day(book?.readings[0]?.finishedOn)).toBe('2025-02-10');
  });

  it('records an abandoned reading for Abandoned', async () => {
    const { cookie, id } = await createSession();
    await post(cookie, { workRef: olWork().ref, status: 'ABANDONED' }).expect(201);
    expect((await booksOf(id))[0]?.readings).toMatchObject([{ state: 'ABANDONED' }]);
  });

  // UTC+14 and UTC-11: at any moment at least one of them is on another date than UTC.
  it.each(['Pacific/Kiritimati', 'Pacific/Pago_Pago'])(
    'starts a Reading book on the date in %s',
    async (timeZone) => {
      const { cookie, id } = await createSession(timeZone);
      const before = localToday(timeZone);

      await post(cookie, { workRef: olWork().ref, status: 'READING' }).expect(201);

      const reading = (await booksOf(id))[0]?.readings[0];
      expect(reading?.state).toBe('IN_PROGRESS');
      expect([before, localToday(timeZone)]).toContain(day(reading?.startedOn));
    },
  );

  it.each([
    { status: 'READING', startedOn: '2025-01-02' },
    { status: 'READ', startedOn: '2025-02-10', finishedOn: '2025-01-02' },
    { status: 'READ', finishedOn: '2025-02-30' },
    { status: 'PAUSED' },
  ])('answers 400 VALIDATION_ERROR for %o', async (extra) => {
    const { cookie } = await createSession();
    expectProblem(await post(cookie, { workRef: olWork().ref, ...extra }), 400, 'VALIDATION_ERROR');
  });

  it('rejects a future date and writes nothing', async () => {
    const { cookie, id } = await createSession();
    const { key, ref } = olWork();

    const res = await post(cookie, { workRef: ref, status: 'READ', finishedOn: '2999-01-01' });

    expectProblem(res, 400, 'READING_DATE_IN_FUTURE');
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(0);
    expect(await booksOf(id)).toEqual([]);
  });

  it('answers 422 for an edition of another work or a work without editions', async () => {
    const { cookie } = await createSession();
    const a = olWork();
    const b = olWork();
    expectProblem(
      await post(cookie, { workRef: a.ref, editionRef: b.editionRef, status: 'READ' }),
      422,
      'EDITION_NOT_IN_WORK',
    );

    const empty = uniqueKey('W');
    fake.addWork({
      olWorkKey: empty,
      title: `${TAG} empty`,
      subtitle: null,
      description: null,
      firstPublishYear: null,
      coverUrl: null,
      authorKeys: [],
      subjects: [],
    });
    expectProblem(
      await post(cookie, { workRef: `ol:${empty}`, status: 'READ' }),
      422,
      'NO_EDITION_AVAILABLE',
    );
    expect(await prisma.work.count({ where: { olWorkKey: empty } })).toBe(0);
  });

  it('answers 409 for a second add, also when the book is archived', async () => {
    const { cookie, id } = await createSession();
    const { ref } = olWork();
    const first = await post(cookie, { workRef: ref, status: 'WANT_TO_READ' }).expect(201);
    const body = addToLibraryResponseSchema.parse(first.body);

    expectProblem(
      await post(cookie, { workRef: ref, status: 'READ' }),
      409,
      'BOOK_ALREADY_IN_LIBRARY',
    );
    await prisma.userBook.update({
      where: { id: body.userBookId },
      data: { archivedAt: new Date() },
    });
    expectProblem(
      await post(cookie, { workRef: body.workRef, status: 'READ' }),
      409,
      'BOOK_ALREADY_IN_LIBRARY',
    );
    expect(await booksOf(id)).toHaveLength(1);
  });

  it('gives one 201 and one 409 for two concurrent adds', async () => {
    const { cookie, id } = await createSession();
    const { key, ref } = olWork();
    const add = () => post(cookie, { workRef: ref, status: 'READ' });

    const results = await Promise.all([add(), add()]);

    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(1);
    expect(await prisma.edition.count({ where: { work: { olWorkKey: key } } })).toBe(1);
    const books = await booksOf(id);
    expect(books).toHaveLength(1);
    expect(books[0]?.readings).toHaveLength(1);
  });

  it('shares one work between two users', async () => {
    const a = await createSession();
    const b = await createSession();
    const { key, ref } = olWork();

    const first = await post(a.cookie, { workRef: ref, status: 'READ' }).expect(201);
    const second = await post(b.cookie, { workRef: ref, status: 'READING' }).expect(201);

    expect(second.body.workRef).toBe(first.body.workRef);
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(1);
  });

  it('leaves no book behind when saving the readings fails', async () => {
    const { cookie, id } = await createSession();
    vi.spyOn(app.get(ReadingRepository, { strict: false }), 'create').mockRejectedValueOnce(
      new Error('boom'),
    );

    const res = await post(cookie, { workRef: olWork().ref, status: 'READ' });

    expectProblem(res, 500, 'INTERNAL_ERROR');
    expect(await booksOf(id)).toEqual([]);
    expect(await prisma.reading.count({ where: { userBook: { userId: id } } })).toBe(0);
  });

  it("answers 404 for another user's private work and writes nothing", async () => {
    const owner = await createSession();
    const other = await createSession();
    const work = await prisma.work.create({
      data: {
        id: uuidv7(),
        title: `${TAG} private`,
        source: 'MANUAL',
        catalogStatus: 'PRIVATE',
        createdById: owner.id,
        editions: { create: { id: uuidv7(), title: `${TAG} ed` } },
      },
    });

    expectProblem(
      await post(other.cookie, { workRef: work.id, status: 'READ' }),
      404,
      'CATALOG_NOT_FOUND',
    );
    expect(await booksOf(other.id)).toEqual([]);
    await post(owner.cookie, { workRef: work.id, status: 'READ' }).expect(201);
  });

  it('answers 503 during an outage and writes nothing', async () => {
    const { cookie, id } = await createSession();
    const { key, ref } = olWork();
    fake.unavailable = true;

    expectProblem(await post(cookie, { workRef: ref, status: 'READ' }), 503, 'CATALOG_UNAVAILABLE');
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(0);
    expect(await booksOf(id)).toEqual([]);
  });
});
