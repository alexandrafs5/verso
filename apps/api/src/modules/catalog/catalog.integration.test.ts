import 'reflect-metadata';
import { type INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  authorDetailSchema,
  editionDtoSchema,
  isbnResultSchema,
  problemSchema,
  searchBooksResponseSchema,
  seriesDetailSchema,
  workDetailSchema,
} from '@verso/shared';
import request from 'supertest';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { AppModule } from '../../app.module.js';
import { RATE_LIMITS } from '../../common/rate-limit/rate-limit.js';
import { CATALOG_PROVIDER, type CatalogProvider } from '../../infra/catalog/catalog-provider.js';
import { InMemoryCatalogProvider } from '../../infra/catalog/in-memory-catalog.provider.js';
import { EMAIL_PROVIDER, type EmailProvider } from '../../infra/email/email.provider.js';
import { InMemoryEmailProvider } from '../../infra/email/in-memory-email.provider.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { FILE_STORAGE, type FileStorage } from '../../infra/storage/file-storage.js';
import { InMemoryFileStorage } from '../../infra/storage/in-memory-file-storage.js';
import { setupApp } from '../../setup-app.js';

process.env['BETTER_AUTH_SECRET'] ??= 'test-secret-test-secret-test-secret';
process.env['BETTER_AUTH_URL'] ??= 'http://localhost:3000';
process.env['WEB_ORIGIN'] ??= 'http://localhost:3000';
// Many sign-ups from one IP: the auth limiter has its own tests.
process.env['AUTH_RATE_LIMIT_ENABLED'] = 'false';

const ORIGIN = 'http://localhost:3000';
const EMAIL_DOMAIN = '@v1-catalog.local';
const PASSWORD = 'correct horse battery';
const TAG = `ci${Date.now().toString(36)}`;

let counter = 0;
const uniqueEmail = (): string => `user${Date.now()}-${counter++}${EMAIL_DOMAIN}`;

const fake = new InMemoryCatalogProvider()
  .addSearchResult({
    olWorkKey: 'OL1W',
    title: 'Pedro Páramo',
    authors: [{ olAuthorKey: 'OL1A', name: 'Juan Rulfo' }],
    firstPublishYear: 1955,
    coverUrl: null,
    editionCount: 2,
    languages: ['es'],
  })
  .addWork({
    olWorkKey: 'OL1W',
    title: 'Pedro Páramo',
    subtitle: null,
    description: 'A novel.',
    firstPublishYear: 1955,
    coverUrl: null,
    authorKeys: ['OL1A'],
    subjects: ['Fiction'],
  })
  .addAuthor({
    olAuthorKey: 'OL1A',
    name: 'Juan Rulfo',
    bio: null,
    birthYear: 1917,
    deathYear: 1986,
    photoUrl: null,
  })
  .addEdition({
    olEditionKey: 'OL1M',
    olWorkKey: 'OL1W',
    title: 'Pedro Páramo',
    isbn10: null,
    isbn13: '9788437604947',
    publisher: null,
    publishYear: 1955,
    language: 'es',
    pageCount: 128,
    format: 'PAPERBACK',
    coverUrl: null,
  })
  .addEdition({
    olEditionKey: 'OL2M',
    olWorkKey: 'OL1W',
    title: 'Pedro Páramo',
    isbn10: null,
    isbn13: '9780802163486',
    publisher: null,
    publishYear: 1994,
    language: 'en',
    pageCount: 124,
    format: 'PAPERBACK',
    coverUrl: null,
  });

describe('Catalog endpoints (HTTP, real Postgres, fake provider)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let server: Parameters<typeof request>[0];
  const mailbox = new InMemoryEmailProvider();

  const cookieOf = (res: request.Response): string =>
    ((res.headers['set-cookie'] as unknown as string[] | undefined) ?? [])
      .map((c) => c.split(';')[0])
      .join('; ');

  const createSession = async (): Promise<{ cookie: string; id: string }> => {
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
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return { cookie: cookieOf(signIn), id: user.id };
  };

  const get = (path: string, cookie: string) =>
    request(server).get(`/api/v1${path}`).set('Cookie', cookie);

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
    const storage = new InMemoryFileStorage();
    const realStorage = app.get<FileStorage>(FILE_STORAGE);
    realStorage.createUploadUrl = (path, contentType) => storage.createUploadUrl(path, contentType);
    // No test hits Open Library: route every provider call to the fake.
    const provider = app.get<CatalogProvider>(CATALOG_PROVIDER);
    provider.searchWorks = (q, page) => fake.searchWorks(q, page);
    provider.getWork = (key) => fake.getWork(key);
    provider.listEditions = (key, opts) => fake.listEditions(key, opts);
    provider.getEditionByIsbn = (isbn) => fake.getEditionByIsbn(isbn);
    provider.getAuthor = (key) => fake.getAuthor(key);
    await cleanUsers();
  });

  afterAll(async () => {
    fake.unavailable = false;
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.series.deleteMany({ where: { name: { startsWith: TAG } } });
    await cleanUsers();
    await app.close();
  });

  const expectProblem = (res: request.Response, status: number, code: string) => {
    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toContain('application/problem+json');
    expect(problemSchema.parse(res.body).code).toBe(code);
  };

  it('answers 401 on every endpoint without a session', async () => {
    const paths = [
      '/search/books?q=a',
      '/works/ol:OL1W',
      '/works/ol:OL1W/editions',
      '/authors/ol:OL1A',
      `/series/${uuidv7()}`,
      '/isbn/9788437604947',
    ];
    for (const path of paths) {
      const res = await request(server).get(`/api/v1${path}`);
      expect(res.status, path).toBe(401);
    }
  });

  it('searches books and validates the query', async () => {
    const { cookie } = await createSession();
    const ok = await get('/search/books?q=Pedro', cookie);
    expect(ok.status).toBe(200);
    const body = searchBooksResponseSchema.parse(ok.body);
    expect(body.items[0]).toMatchObject({ ref: 'ol:OL1W', libraryStatus: null });
    expect(body.moreMatches).toEqual([]);
    expect(body.nextCursor).not.toBeNull();

    expect((await get('/search/books?genre=Fiction', cookie)).status).toBe(200);
    expect((await get('/search/books?q=dune&genre=Fiction', cookie)).status).toBe(200);

    expectProblem(await get('/search/books', cookie), 400, 'VALIDATION_ERROR');
    expectProblem(await get('/search/books?cursor=abc', cookie), 400, 'VALIDATION_ERROR');
    expectProblem(await get('/search/books?genre=%22%22', cookie), 400, 'VALIDATION_ERROR');
    expectProblem(await get(`/search/books?q=${'a'.repeat(201)}`, cookie), 400, 'VALIDATION_ERROR');
    expectProblem(await get('/search/books?q=a&cursor=garbage', cookie), 400, 'INVALID_CURSOR');
  });

  it('serves a work, its editions, and filters editions by language', async () => {
    const { cookie } = await createSession();
    const work = await get('/works/ol:OL1W', cookie);
    expect(work.status).toBe(200);
    expect(workDetailSchema.parse(work.body)).toMatchObject({
      ref: 'ol:OL1W',
      authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
      genres: ['Fiction'],
    });

    const all = await get('/works/ol:OL1W/editions', cookie);
    expect(editionDtoSchema.array().parse(all.body)).toHaveLength(2);
    const es = await get('/works/ol:OL1W/editions?language=es', cookie);
    expect(
      editionDtoSchema
        .array()
        .parse(es.body)
        .map((e) => e.ref),
    ).toEqual(['ol:OL1M']);
    expectProblem(
      await get('/works/ol:OL1W/editions?language=spa', cookie),
      400,
      'VALIDATION_ERROR',
    );
  });

  it('maps bad refs to 400 and unknown works to 404', async () => {
    const { cookie } = await createSession();
    expectProblem(await get('/works/nope', cookie), 400, 'INVALID_REF');
    expectProblem(await get('/works/ol:OL1A', cookie), 400, 'INVALID_REF');
    expectProblem(await get('/works/ol:OL404W', cookie), 404, 'CATALOG_NOT_FOUND');
    expectProblem(await get(`/works/${uuidv7()}`, cookie), 404, 'CATALOG_NOT_FOUND');
    expectProblem(await get('/authors/ol:OL1W', cookie), 400, 'INVALID_REF');
  });

  it('hides a private manual work from other users', async () => {
    const owner = await createSession();
    const other = await createSession();
    const work = await prisma.work.create({
      data: {
        id: uuidv7(),
        title: `${TAG} private`,
        source: 'MANUAL',
        catalogStatus: 'PRIVATE',
        createdById: owner.id,
      },
    });
    expect((await get(`/works/${work.id}`, owner.cookie)).status).toBe(200);
    expectProblem(await get(`/works/${work.id}`, other.cookie), 404, 'CATALOG_NOT_FOUND');
    expectProblem(await get(`/works/${work.id}/editions`, other.cookie), 404, 'CATALOG_NOT_FOUND');
  });

  it('serves an author and a series', async () => {
    const { cookie } = await createSession();
    const author = await get('/authors/ol:OL1A', cookie);
    expect(author.status).toBe(200);
    expect(authorDetailSchema.parse(author.body)).toMatchObject({ ref: 'ol:OL1A' });

    const series = await prisma.series.create({ data: { id: uuidv7(), name: `${TAG} s` } });
    await prisma.work.create({
      data: { id: uuidv7(), title: `${TAG} one`, seriesId: series.id, seriesPosition: 1.5 },
    });
    const res = await get(`/series/${series.id}`, cookie);
    expect(res.status).toBe(200);
    expect(seriesDetailSchema.parse(res.body).works[0]?.position).toBe(1.5);
    expectProblem(await get(`/series/${uuidv7()}`, cookie), 404, 'CATALOG_NOT_FOUND');
    expectProblem(await get('/series/not-a-uuid', cookie), 400, 'INVALID_REF');
  });

  it('looks up an ISBN', async () => {
    const { cookie } = await createSession();
    const ok = await get('/isbn/978-84-376-0494-7', cookie);
    expect(ok.status).toBe(200);
    expect(isbnResultSchema.parse(ok.body).workRef).toBe('ol:OL1W');
    expectProblem(await get('/isbn/9780000000002', cookie), 404, 'CATALOG_NOT_FOUND');
    expectProblem(await get('/isbn/12345', cookie), 400, 'INVALID_ISBN');
  });

  it('answers 503 CATALOG_UNAVAILABLE when the provider is down', async () => {
    const { cookie } = await createSession();
    fake.unavailable = true;
    try {
      expectProblem(await get('/search/books?q=Pedro', cookie), 503, 'CATALOG_UNAVAILABLE');
      expectProblem(await get('/works/ol:OL1W', cookie), 503, 'CATALOG_UNAVAILABLE');
    } finally {
      fake.unavailable = false;
    }
  });

  it('limits search to 60/min/user and other reads to 120/min/user', async () => {
    const searcher = await createSession();
    const search = () => get('/search/books?q=Pedro', searcher.cookie);
    for (let i = 0; i < RATE_LIMITS.search; i++) expect((await search()).status).toBe(200);
    expectProblem(await search(), 429, 'RATE_LIMITED');

    const reader = await createSession();
    const read = () => get('/isbn/9788437604947', reader.cookie);
    for (let i = 0; i < RATE_LIMITS.catalogRead; i++) expect((await read()).status).toBe(200);
    expectProblem(await read(), 429, 'RATE_LIMITED');
    // The search bucket is separate: a throttled reader can still search.
    expect((await get('/search/books?q=Pedro', reader.cookie)).status).toBe(200);
  }, 60_000);
});
