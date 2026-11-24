import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ErrorCode } from '@verso/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ApiException } from '../../common/api-exception.js';
import type { SearchOptions, WorkSearchResult } from '../../infra/catalog/catalog-provider.js';
import { mapSearchDoc } from '../../infra/catalog/open-library-mappers.js';
import { loadFixture } from '../../infra/catalog/test-fixtures.js';
import { InMemoryCatalogProvider } from '../../infra/catalog/in-memory-catalog.provider.js';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import { encodeCursor } from './domain/catalog-ref.js';

const TAG = `cs${Date.now().toString(36)}`;

/** Records the queries and pages the service sends. */
class RecordingProvider extends InMemoryCatalogProvider {
  readonly searches: { query: string; page: number; opts: SearchOptions | undefined }[] = [];
  /** Exact query to canned results, for queries the in-memory matcher cannot answer. */
  readonly canned = new Map<string, WorkSearchResult[]>();

  override searchWorks(
    query: string,
    page: number,
    opts?: SearchOptions,
  ): Promise<WorkSearchResult[]> {
    this.searches.push({ query, page, opts });
    const canned = this.canned.get(query);
    if (canned) return Promise.resolve(canned);
    return super.searchWorks(query, page, opts);
  }
}

const searchResult = (key: string, title: string): WorkSearchResult => ({
  olWorkKey: key,
  title,
  authors: [{ olAuthorKey: 'OL1A', name: 'Juan Rulfo' }],
  firstPublishYear: 1955,
  coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
  editionCount: 12,
  languages: ['es'],
});

async function failsWith(promise: Promise<unknown>, status: number, code: string): Promise<void> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).getStatus()).toBe(status);
  expect((error as ApiException).code).toBe(code);
}

describe('CatalogService search and work (real Postgres, fake provider)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let provider: RecordingProvider;
  let service: CatalogService;

  const userId = uuidv7();
  const otherId = uuidv7();

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
    prisma = ctx.get(PrismaService);
    close = () => ctx.close();
    for (const id of [userId, otherId]) {
      await prisma.user.create({
        data: { id, email: `${TAG}-${id}@example.com`, name: `${TAG} user` },
      });
    }
  });

  afterEach(async () => {
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.author.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.genre.deleteMany({ where: { slug: { startsWith: TAG } } });
    await prisma.series.deleteMany({ where: { name: { startsWith: TAG } } });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await close();
  });

  const fresh = () => {
    provider = new RecordingProvider();
    service = new CatalogService(new CatalogRepository(prisma), provider);
  };

  describe('searchBooks', () => {
    it('maps results to summaries with ol refs and a null library status', async () => {
      fresh();
      provider.addSearchResult(searchResult('OL1W', 'Pedro Páramo'));
      const res = await service.searchBooks({ q: 'Pedro' });
      expect(res.items).toEqual([
        {
          ref: 'ol:OL1W',
          title: 'Pedro Páramo',
          authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
          firstPublishYear: 1955,
          coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
          editionCount: 12,
          libraryStatus: null,
        },
      ]);
    });

    it('sends the genre as a subject clause and strips quotes', async () => {
      fresh();
      await service.searchBooks({ q: 'Pedro Páramo', genre: 'Fic"tion' });
      expect(provider.searches).toEqual([
        { query: 'Pedro Páramo subject:"Fiction"', page: 1, opts: { sort: 'editions' } },
      ]);
    });

    it('sets nextCursor to the next page and follows it', async () => {
      fresh();
      provider.addSearchResult(searchResult('OL1W', 'Pedro Páramo'));
      const first = await service.searchBooks({ q: 'Pedro' });
      expect(first.nextCursor).toBe(encodeCursor(2));

      await service.searchBooks({ q: 'Pedro', cursor: first.nextCursor ?? '' });
      expect(provider.searches.map((s) => s.page)).toEqual([1, 2]);
    });

    it('asks for popularity order on every search page', async () => {
      fresh();
      provider.addSearchResult(searchResult('OL1W', 'Pedro Páramo'));
      const first = await service.searchBooks({ q: 'Pedro' });
      await service.searchBooks({ q: 'Pedro', cursor: first.nextCursor ?? '' });
      expect(provider.searches.map((s) => s.opts)).toEqual([
        { sort: 'editions' },
        { sort: 'editions' },
      ]);
    });

    describe('collapse and fold', () => {
      const tail = (n: number): WorkSearchResult => ({
        ...searchResult(`OL${n}W`, `Study ${n}`),
        authors: [{ olAuthorKey: `OL${n}A`, name: `Author ${n}` }],
        editionCount: 1,
      });

      it('merges duplicates and folds the 1-edition tail on the first page', async () => {
        fresh();
        provider.canned.set('Pedro', [
          searchResult('OL1W', 'Pedro Páramo'),
          { ...searchResult('OL2W', 'Pedro Paramo'), editionCount: 3 },
          tail(7),
        ]);
        const res = await service.searchBooks({ q: 'Pedro' });
        expect(res.items.map((i) => [i.ref, i.editionCount])).toEqual([['ol:OL1W', 15]]);
        expect(res.moreMatches.map((i) => i.ref)).toEqual(['ol:OL7W']);
        expect(res.nextCursor).toBe(encodeCursor(2));
      });

      it('keeps every result in items when the first page has only 1-edition works', async () => {
        fresh();
        provider.canned.set('Tail', [tail(7), tail(8)]);
        const res = await service.searchBooks({ q: 'Tail' });
        expect(res.items).toHaveLength(2);
        expect(res.moreMatches).toEqual([]);
      });

      it('folds 1-edition works on a later page, even when items ends up empty', async () => {
        fresh();
        provider.canned.set('Tail', [tail(7), tail(8)]);
        const res = await service.searchBooks({ q: 'Tail', cursor: encodeCursor(2) });
        expect(res.items).toEqual([]);
        expect(res.moreMatches.map((i) => i.ref)).toEqual(['ol:OL7W', 'ol:OL8W']);
        expect(res.nextCursor).toBe(encodeCursor(3));
      });

      it('collapses the pedro paramo fixture to one Pedro Páramo item', async () => {
        fresh();
        const docs = loadFixture<{ docs: unknown[] }>('search-pedro-paramo.json').docs;
        provider.canned.set(
          'pedro paramo',
          docs.flatMap((doc) => mapSearchDoc(doc) ?? []),
        );
        const res = await service.searchBooks({ q: 'pedro paramo' });
        const rulfo = res.items.filter(
          (i) => i.title === 'Pedro Páramo' && i.authors[0]?.ref === 'ol:OL199285A',
        );
        expect(rulfo).toHaveLength(1);
        expect(rulfo[0]?.editionCount).toBeGreaterThanOrEqual(160);
        expect(res.moreMatches.length).toBeGreaterThan(0);
        expect(res.moreMatches.every((m) => (m.editionCount ?? 0) <= 1)).toBe(true);
        expect(res.items.every((i) => i.libraryStatus === null)).toBe(true);
      });

      it('returns two empty lists and no cursor for an empty provider page', async () => {
        fresh();
        const res = await service.searchBooks({ q: 'nothing', cursor: encodeCursor(5) });
        expect(res).toEqual({ items: [], moreMatches: [], nextCursor: null });
      });
    });

    it('returns a null nextCursor on an empty page', async () => {
      fresh();
      const res = await service.searchBooks({ q: 'nothing' });
      expect(res).toEqual({ items: [], moreMatches: [], nextCursor: null });
    });

    it('rejects a malformed cursor without calling the provider', async () => {
      fresh();
      await failsWith(
        service.searchBooks({ q: 'a', cursor: 'garbage' }),
        400,
        ErrorCode.INVALID_CURSOR,
      );
      expect(provider.searches).toEqual([]);
    });

    it('maps an outage to 503 CATALOG_UNAVAILABLE', async () => {
      fresh();
      provider.unavailable = true;
      await failsWith(service.searchBooks({ q: 'a' }), 503, ErrorCode.CATALOG_UNAVAILABLE);
    });
  });

  describe('getWork', () => {
    const olWork = (authorKeys: string[], subjects: string[] = []) => ({
      olWorkKey: 'OL1W',
      title: 'Pedro Páramo',
      subtitle: null,
      description: 'A novel.',
      firstPublishYear: 1955,
      coverUrl: null,
      authorKeys,
      subjects,
    });
    const olAuthor = (key: string, name: string) => ({
      olAuthorKey: key,
      name,
      bio: null,
      birthYear: null,
      deathYear: null,
      photoUrl: null,
    });

    it('serves an unpersisted Open Library work with author names and writes nothing', async () => {
      fresh();
      provider.addWork(olWork(['OL1A'])).addAuthor(olAuthor('OL1A', 'Juan Rulfo'));

      const work = await service.getWork(userId, 'ol:OL1W');
      expect(work).toMatchObject({
        ref: 'ol:OL1W',
        title: 'Pedro Páramo',
        authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
        series: null,
        source: 'OPEN_LIBRARY',
        libraryStatus: null,
      });
      expect(await prisma.work.count({ where: { olWorkKey: 'OL1W' } })).toBe(0);
      expect(await prisma.edition.count({ where: { work: { olWorkKey: 'OL1W' } } })).toBe(0);
      expect(await prisma.author.count({ where: { olAuthorKey: 'OL1A' } })).toBe(0);
    });

    it('keeps at most 8 genres and 5 authors', async () => {
      fresh();
      const keys = ['OL1A', 'OL2A', 'OL3A', 'OL4A', 'OL5A', 'OL6A'];
      provider.addWork(
        olWork(
          keys,
          Array.from({ length: 12 }, (_, i) => `s${i}`),
        ),
      );
      for (const key of keys) provider.addAuthor(olAuthor(key, key));

      const work = await service.getWork(userId, 'ol:OL1W');
      expect(work.genres).toHaveLength(8);
      expect(work.authors.map((a) => a.ref)).toEqual(keys.slice(0, 5).map((k) => `ol:${k}`));
    });

    it('drops an author Open Library does not know but fails on an outage', async () => {
      fresh();
      provider.addWork(olWork(['OL1A', 'OL9A'])).addAuthor(olAuthor('OL1A', 'Juan Rulfo'));
      const work = await service.getWork(userId, 'ol:OL1W');
      expect(work.authors).toEqual([{ ref: 'ol:OL1A', name: 'Juan Rulfo' }]);

      provider.unavailable = true;
      await failsWith(service.getWork(userId, 'ol:OL1W'), 503, ErrorCode.CATALOG_UNAVAILABLE);
    });

    it('returns 404 CATALOG_NOT_FOUND for an unknown Open Library work', async () => {
      fresh();
      await failsWith(service.getWork(userId, 'ol:OL404W'), 404, ErrorCode.CATALOG_NOT_FOUND);
    });

    it('rejects malformed refs with 400 INVALID_REF', async () => {
      fresh();
      for (const ref of ['nope', 'ol:OL1A', 'OL1W', '../etc']) {
        await failsWith(service.getWork(userId, ref), 400, ErrorCode.INVALID_REF);
      }
    });

    it('serves a persisted work with local authors, genres and series', async () => {
      fresh();
      const series = await prisma.series.create({ data: { id: uuidv7(), name: `${TAG} s` } });
      const genre = await prisma.genre.create({
        data: { id: uuidv7(), slug: `${TAG}-g`, name: 'Fiction' },
      });
      const author = await prisma.author.create({
        data: { id: uuidv7(), name: `${TAG} author` },
      });
      const work = await prisma.work.create({
        data: {
          id: uuidv7(),
          title: `${TAG} work`,
          seriesId: series.id,
          seriesPosition: 1.5,
          authors: { create: { authorId: author.id } },
          genres: { create: { genreId: genre.id } },
        },
      });

      const res = await service.getWork(userId, work.id);
      expect(res.ref).toBe(work.id);
      expect(res.authors).toEqual([{ ref: author.id, name: `${TAG} author` }]);
      expect(res.genres).toEqual(['Fiction']);
      expect(res.series).toEqual({ id: series.id, name: `${TAG} s`, position: 1.5 });
    });

    it('returns the local id for an ol ref that was persisted', async () => {
      fresh();
      const key = `OL${Date.now()}W`;
      const work = await prisma.work.create({
        data: { id: uuidv7(), title: `${TAG} persisted`, olWorkKey: key },
      });
      // The provider does not know this key: the local row must answer.
      const res = await service.getWork(userId, `ol:${key}`);
      expect(res.ref).toBe(work.id);
    });

    it('shows a private manual work to its creator only', async () => {
      fresh();
      const work = await prisma.work.create({
        data: {
          id: uuidv7(),
          title: `${TAG} private`,
          source: 'MANUAL',
          catalogStatus: 'PRIVATE',
          createdById: userId,
        },
      });
      expect((await service.getWork(userId, work.id)).ref).toBe(work.id);
      await failsWith(service.getWork(otherId, work.id), 404, ErrorCode.CATALOG_NOT_FOUND);
    });

    it('returns 404 for an unknown UUID', async () => {
      fresh();
      await failsWith(service.getWork(userId, uuidv7()), 404, ErrorCode.CATALOG_NOT_FOUND);
    });
  });

  describe('getEditions', () => {
    const ed = (key: string, language: string | null) => ({
      olEditionKey: key,
      olWorkKey: 'OL1W',
      title: 'Pedro Páramo',
      isbn10: null,
      isbn13: null,
      publisher: null,
      publishYear: null,
      language,
      pageCount: null,
      format: 'PAPERBACK' as const,
      coverUrl: null,
    });
    const seedWork = () =>
      provider
        .addWork({
          olWorkKey: 'OL1W',
          title: 'Pedro Páramo',
          subtitle: null,
          description: null,
          firstPublishYear: null,
          coverUrl: null,
          authorKeys: [],
          subjects: [],
        })
        .addEdition(ed('OL1M', 'es'))
        .addEdition(ed('OL2M', 'en'));

    it('lists provider editions for an Open Library work, filtered by language', async () => {
      fresh();
      seedWork();
      expect((await service.getEditions(userId, 'ol:OL1W')).map((e) => e.ref)).toEqual([
        'ol:OL1M',
        'ol:OL2M',
      ]);
      expect((await service.getEditions(userId, 'ol:OL1W', 'es')).map((e) => e.ref)).toEqual([
        'ol:OL1M',
      ]);
    });

    it('uses the provider for a persisted Open Library work', async () => {
      fresh();
      seedWork();
      const work = await prisma.work.create({
        data: { id: uuidv7(), title: `${TAG} w`, olWorkKey: 'OL1W' },
      });
      expect(await service.getEditions(userId, work.id)).toHaveLength(2);
    });

    it('lists local editions of a manual work, filtered by language', async () => {
      fresh();
      const work = await prisma.work.create({
        data: { id: uuidv7(), title: `${TAG} manual`, source: 'MANUAL', createdById: userId },
      });
      const local = (language: string) =>
        prisma.edition.create({
          data: { id: uuidv7(), workId: work.id, title: `${TAG} e`, language, source: 'MANUAL' },
        });
      const es = await local('es');
      await local('en');

      expect(await service.getEditions(userId, work.id)).toHaveLength(2);
      expect((await service.getEditions(userId, work.id, 'es')).map((e) => e.ref)).toEqual([es.id]);
    });

    it('hides editions of a private work, rejects bad refs and unknown works', async () => {
      fresh();
      const work = await prisma.work.create({
        data: {
          id: uuidv7(),
          title: `${TAG} private`,
          source: 'MANUAL',
          catalogStatus: 'PRIVATE',
          createdById: userId,
        },
      });
      await failsWith(service.getEditions(otherId, work.id), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getEditions(userId, 'bad'), 400, ErrorCode.INVALID_REF);
      await failsWith(service.getEditions(userId, uuidv7()), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getEditions(userId, 'ol:OL9W'), 404, ErrorCode.CATALOG_NOT_FOUND);
    });
  });

  describe('getAuthor', () => {
    const olAuthor = {
      olAuthorKey: 'OL1A',
      name: 'Juan Rulfo',
      bio: 'Mexican writer.',
      birthYear: 1917,
      deathYear: 1986,
      photoUrl: null,
    };

    it('returns an Open Library author with works ordered by year, unknown last', async () => {
      fresh();
      provider.addAuthor(olAuthor);
      provider.canned.set('author_key:OL1A', [
        { ...searchResult('OL3W', 'Unknown'), firstPublishYear: null },
        { ...searchResult('OL2W', 'Late'), firstPublishYear: 1980 },
        { ...searchResult('OL1W', 'Early'), firstPublishYear: 1953 },
      ]);

      const author = await service.getAuthor('ol:OL1A');
      expect(author).toMatchObject({
        ref: 'ol:OL1A',
        name: 'Juan Rulfo',
        bio: 'Mexican writer.',
        birthYear: 1917,
        deathYear: 1986,
      });
      expect(author.works.map((w) => w.title)).toEqual(['Early', 'Late', 'Unknown']);
      expect(provider.searches).toEqual([{ query: 'author_key:OL1A', page: 1, opts: undefined }]);
    });

    it('serves a local author with a key through the provider and returns the local id', async () => {
      fresh();
      const local = await prisma.author.create({
        data: { id: uuidv7(), name: `${TAG} rulfo`, olAuthorKey: 'OL7A' },
      });
      provider.canned.set('author_key:OL7A', [searchResult('OL1W', 'Pedro Páramo')]);

      const byId = await service.getAuthor(local.id);
      expect(byId.ref).toBe(local.id);
      expect(byId.works.map((w) => w.title)).toEqual(['Pedro Páramo']);
      expect((await service.getAuthor('ol:OL7A')).ref).toBe(local.id);
    });

    it('serves a local author without a key from WorkAuthor, public works only', async () => {
      fresh();
      const local = await prisma.author.create({ data: { id: uuidv7(), name: `${TAG} manual` } });
      const make = (title: string, catalogStatus: 'PUBLIC' | 'PRIVATE') =>
        prisma.work.create({
          data: {
            id: uuidv7(),
            title: `${TAG} ${title}`,
            catalogStatus,
            authors: { create: { authorId: local.id } },
          },
        });
      await make('public', 'PUBLIC');
      await make('private', 'PRIVATE');

      const res = await service.getAuthor(local.id);
      expect(res.works.map((w) => w.title)).toEqual([`${TAG} public`]);
      expect(provider.searches).toEqual([]);
    });

    it('maps unknown authors, bad refs and outages', async () => {
      fresh();
      await failsWith(service.getAuthor('ol:OL404A'), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getAuthor(uuidv7()), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getAuthor('ol:OL1W'), 400, ErrorCode.INVALID_REF);
      provider.addAuthor(olAuthor);
      provider.unavailable = true;
      await failsWith(service.getAuthor('ol:OL1A'), 503, ErrorCode.CATALOG_UNAVAILABLE);
    });
  });

  describe('getSeries', () => {
    it('orders works by position and keeps 1.5, without private works', async () => {
      fresh();
      const series = await prisma.series.create({ data: { id: uuidv7(), name: `${TAG} s` } });
      const make = (title: string, position: number | null, status: 'PUBLIC' | 'PRIVATE') =>
        prisma.work.create({
          data: {
            id: uuidv7(),
            title: `${TAG} ${title}`,
            seriesId: series.id,
            seriesPosition: position,
            catalogStatus: status,
          },
        });
      await make('two', 2, 'PUBLIC');
      await make('half', 1.5, 'PUBLIC');
      await make('none', null, 'PUBLIC');
      await make('hidden', 1, 'PRIVATE');

      const res = await service.getSeries(series.id);
      expect(res.name).toBe(`${TAG} s`);
      expect(res.works.map((w) => [w.title.replace(`${TAG} `, ''), w.position])).toEqual([
        ['half', 1.5],
        ['two', 2],
        ['none', null],
      ]);
    });

    it('returns 404 for an unknown id and 400 for a non-UUID', async () => {
      fresh();
      await failsWith(service.getSeries(uuidv7()), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getSeries('ol:OL1W'), 400, ErrorCode.INVALID_REF);
    });
  });

  describe('lookupIsbn', () => {
    const edition = {
      olEditionKey: 'OL1M',
      olWorkKey: 'OL1W' as string | null,
      title: 'Pedro Páramo',
      isbn10: null,
      isbn13: '9788437604947',
      publisher: null,
      publishYear: 1955,
      language: 'es',
      pageCount: 128,
      format: 'PAPERBACK' as const,
      coverUrl: null,
    };

    it('normalizes hyphens and returns the work ref and edition', async () => {
      fresh();
      provider.addEdition(edition);
      const res = await service.lookupIsbn('978-84-376-0494-7');
      expect(res.workRef).toBe('ol:OL1W');
      expect(res.edition).toMatchObject({ ref: 'ol:OL1M', isbn13: '9788437604947' });
    });

    it('returns the local work id when the work was persisted', async () => {
      fresh();
      provider.addEdition(edition);
      const work = await prisma.work.create({
        data: { id: uuidv7(), title: `${TAG} w`, olWorkKey: 'OL1W' },
      });
      expect((await service.lookupIsbn('9788437604947')).workRef).toBe(work.id);
    });

    it('returns 404 for an unknown ISBN or an edition without a work', async () => {
      fresh();
      await failsWith(service.lookupIsbn('9780000000002'), 404, ErrorCode.CATALOG_NOT_FOUND);
      provider.addEdition({ ...edition, olWorkKey: null });
      await failsWith(service.lookupIsbn('9788437604947'), 404, ErrorCode.CATALOG_NOT_FOUND);
    });

    it('returns 400 INVALID_ISBN for a malformed ISBN and 503 on an outage', async () => {
      fresh();
      await failsWith(service.lookupIsbn('12345'), 400, ErrorCode.INVALID_ISBN);
      provider.unavailable = true;
      await failsWith(service.lookupIsbn('9788437604947'), 503, ErrorCode.CATALOG_UNAVAILABLE);
    });
  });
});
