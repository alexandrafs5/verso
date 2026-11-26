import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { type BookStatus, ErrorCode } from '@verso/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ApiException } from '../../common/api-exception.js';
import type { SearchOptions, WorkSearchResult } from '../../infra/catalog/catalog-provider.js';
import { mapSearchDoc } from '../../infra/catalog/open-library-mappers.js';
import { loadFixture } from '../../infra/catalog/test-fixtures.js';
import { InMemoryCatalogProvider } from '../../infra/catalog/in-memory-catalog.provider.js';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LibraryStatusRepository } from '../library/library-status.repository.js';
import { LibraryStatusService } from '../library/library-status.service.js';
import { ReadingRepository } from '../reading/reading.repository.js';
import { ReadingService } from '../reading/reading.service.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';
import { encodeCursor } from './domain/catalog-ref.js';

const TAG = `cs${Date.now().toString(36)}`;

const libraryStatus = (prisma: PrismaService) =>
  new LibraryStatusService(
    new LibraryStatusRepository(prisma),
    new ReadingService(new ReadingRepository(prisma)),
  );

/** Records the queries and pages the service sends. */
class RecordingProvider extends InMemoryCatalogProvider {
  readonly searches: { query: string; page: number; sort?: 'editions' }[] = [];
  /** Exact query to canned results, for queries the in-memory matcher cannot answer. */
  readonly canned = new Map<string, WorkSearchResult[]>();

  override searchWorks(
    query: string,
    page: number,
    opts?: SearchOptions,
  ): Promise<WorkSearchResult[]> {
    this.searches.push({ query, page, sort: opts?.sort });
    const canned = this.canned.get(query);
    if (canned) return Promise.resolve(canned);
    return super.searchWorks(query, page);
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
    // Library rows first: they block deleting works.
    await prisma.userBook.deleteMany({ where: { userId: { in: [userId, otherId] } } });
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
    service = new CatalogService(new CatalogRepository(prisma), provider, libraryStatus(prisma));
  };

  describe('searchBooks', () => {
    it('maps results to summaries with ol refs and a null library status', async () => {
      fresh();
      provider.addSearchResult(searchResult('OL1W', 'Pedro Páramo'));
      const res = await service.searchBooks(userId, { q: 'Pedro' });
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
      await service.searchBooks(userId, { q: 'Pedro Páramo', genre: 'Fic"tion' });
      expect(provider.searches).toEqual([{ query: 'Pedro Páramo subject:"Fiction"', page: 1 }]);
    });

    it('sends only the subject clause, most editions first, for a genre-only search', async () => {
      fresh();
      await service.searchBooks(userId, { genre: 'Fiction' });
      expect(provider.searches).toEqual([
        { query: 'subject:"Fiction"', page: 1, sort: 'editions' },
      ]);
    });

    it('keeps the relevance order when there is text, with or without a genre', async () => {
      fresh();
      await service.searchBooks(userId, { q: 'dune' });
      await service.searchBooks(userId, { q: 'dune', genre: 'Fiction' });
      expect(provider.searches.map((s) => s.sort)).toEqual([undefined, undefined]);
    });

    it('keeps the edition-count order on later pages of a genre-only search', async () => {
      fresh();
      provider.canned.set('subject:"Fiction"', [searchResult('OL1W', 'Pedro Páramo')]);
      const first = await service.searchBooks(userId, { genre: 'Fiction' });
      await service.searchBooks(userId, { genre: 'Fiction', cursor: first.nextCursor ?? '' });
      expect(provider.searches.map((s) => [s.page, s.sort])).toEqual([
        [1, 'editions'],
        [2, 'editions'],
      ]);
    });

    it('rejects a genre that is only quotes when there is no q', async () => {
      fresh();
      await expect(service.searchBooks(userId, { genre: '""' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(provider.searches).toEqual([]);
    });

    it('sets nextCursor to the next page and follows it', async () => {
      fresh();
      provider.addSearchResult(searchResult('OL1W', 'Pedro Páramo'));
      const first = await service.searchBooks(userId, { q: 'Pedro' });
      expect(first.nextCursor).toBe(encodeCursor(2));

      await service.searchBooks(userId, { q: 'Pedro', cursor: first.nextCursor ?? '' });
      expect(provider.searches.map((s) => s.page)).toEqual([1, 2]);
    });

    it('keeps the Open Library relevance order and never asks for a sort', async () => {
      fresh();
      provider.addSearchResult(searchResult('OL1W', 'Pedro Páramo'));
      provider.addSearchResult(searchResult('OL2W', 'Pedro Páramo II'));
      const res = await service.searchBooks(userId, { q: 'Pedro' });
      expect(res.items.map((i) => i.ref)).toEqual(['ol:OL1W', 'ol:OL2W']);
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
        const res = await service.searchBooks(userId, { q: 'Pedro' });
        expect(res.items.map((i) => [i.ref, i.editionCount])).toEqual([['ol:OL1W', 15]]);
        expect(res.moreMatches.map((i) => i.ref)).toEqual(['ol:OL7W']);
        expect(res.nextCursor).toBe(encodeCursor(2));
      });

      it('keeps every result in items when the first page has only 1-edition works', async () => {
        fresh();
        provider.canned.set('Tail', [tail(7), tail(8)]);
        const res = await service.searchBooks(userId, { q: 'Tail' });
        expect(res.items).toHaveLength(2);
        expect(res.moreMatches).toEqual([]);
      });

      it('folds 1-edition works on a later page, even when items ends up empty', async () => {
        fresh();
        provider.canned.set('Tail', [tail(7), tail(8)]);
        const res = await service.searchBooks(userId, { q: 'Tail', cursor: encodeCursor(2) });
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
        const res = await service.searchBooks(userId, { q: 'pedro paramo' });
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
        const res = await service.searchBooks(userId, { q: 'nothing', cursor: encodeCursor(5) });
        expect(res).toEqual({ items: [], moreMatches: [], nextCursor: null });
      });
    });

    it('returns a null nextCursor on an empty page', async () => {
      fresh();
      const res = await service.searchBooks(userId, { q: 'nothing' });
      expect(res).toEqual({ items: [], moreMatches: [], nextCursor: null });
    });

    it('rejects a malformed cursor without calling the provider', async () => {
      fresh();
      await failsWith(
        service.searchBooks(userId, { q: 'a', cursor: 'garbage' }),
        400,
        ErrorCode.INVALID_CURSOR,
      );
      expect(provider.searches).toEqual([]);
    });

    it('maps an outage to 503 CATALOG_UNAVAILABLE', async () => {
      fresh();
      provider.unavailable = true;
      await failsWith(service.searchBooks(userId, { q: 'a' }), 503, ErrorCode.CATALOG_UNAVAILABLE);
    });
  });

  describe('library status', () => {
    let counter = 0;
    /** Open Library keys no other test file uses. */
    const uniqueKey = (suffix: 'W' | 'M' | 'A') => `OL${Date.now()}${counter++}${suffix}`;

    /** A saved work with one edition, in the library of `owner`. */
    const inLibrary = async (
      owner: string,
      options: {
        olWorkKey?: string | null;
        status?: BookStatus;
        readings?: ('FINISHED' | 'ABANDONED' | 'IN_PROGRESS')[];
        archived?: boolean;
        addedAt?: Date;
        authorId?: string;
        seriesId?: string;
      } = {},
    ) => {
      const work = await prisma.work.create({
        data: {
          id: uuidv7(),
          title: `${TAG} book ${counter++}`,
          olWorkKey: options.olWorkKey === undefined ? uniqueKey('W') : options.olWorkKey,
          seriesId: options.seriesId,
          ...(options.authorId ? { authors: { create: { authorId: options.authorId } } } : {}),
        },
      });
      const edition = await prisma.edition.create({
        data: { id: uuidv7(), workId: work.id, title: `${TAG} ed`, olEditionKey: uniqueKey('M') },
      });
      const book = await prisma.userBook.create({
        data: {
          id: uuidv7(),
          userId: owner,
          workId: work.id,
          editionId: edition.id,
          status: options.status ?? 'WANT_TO_READ',
          archivedAt: options.archived ? new Date() : null,
          addedAt: options.addedAt,
          readings: {
            create: (options.readings ?? []).map((state, index) => ({
              id: uuidv7(),
              number: index + 1,
              state,
            })),
          },
        },
      });
      const status = {
        userBookId: book.id,
        status: book.status,
        readCount: (options.readings ?? []).filter((state) => state === 'FINISHED').length,
        editionRef: `ol:${edition.olEditionKey}`,
      };
      return { work, edition, book, status, key: work.olWorkKey ?? '' };
    };

    const row = (key: string, title: string, editions = 12): WorkSearchResult => ({
      ...searchResult(key, title),
      editionCount: editions,
    });

    it('fills search rows and folded rows with the viewer books only', async () => {
      fresh();
      const mine = await inLibrary(userId, {
        status: 'READ',
        readings: ['FINISHED', 'ABANDONED', 'FINISHED'],
      });
      const folded = await inLibrary(userId, { status: 'READING', readings: ['IN_PROGRESS'] });
      const theirs = await inLibrary(otherId);
      const archived = await inLibrary(userId, { archived: true });
      provider.canned.set('q', [
        row(mine.key, 'Mine'),
        row(theirs.key, 'Theirs'),
        row(archived.key, 'Archived'),
        row(folded.key, 'Folded', 1),
      ]);

      const res = await service.searchBooks(userId, { q: 'q' });

      expect(res.items.map((i) => [i.title, i.ref, i.libraryStatus])).toEqual([
        ['Mine', mine.work.id, mine.status],
        ['Theirs', `ol:${theirs.key}`, null],
        ['Archived', `ol:${archived.key}`, null],
      ]);
      expect(res.moreMatches.map((i) => [i.ref, i.libraryStatus])).toEqual([
        [folded.work.id, folded.status],
      ]);
      expect(mine.status.readCount).toBe(2);
    });

    it('uses a local edition id when the edition has no Open Library key', async () => {
      fresh();
      const mine = await inLibrary(userId);
      await prisma.edition.update({
        where: { id: mine.edition.id },
        data: { olEditionKey: null },
      });
      const res = await service.getWork(userId, mine.work.id);
      expect(res.libraryStatus?.editionRef).toBe(mine.edition.id);
    });

    it('shows the status of a saved duplicate merged into a row, and links to it', async () => {
      fresh();
      const saved = await inLibrary(userId);
      const popular = uniqueKey('W');
      provider.canned.set('q', [row(popular, 'Same Book', 50), row(saved.key, 'Same book', 2)]);

      const res = await service.searchBooks(userId, { q: 'q' });

      expect(res.items).toHaveLength(1);
      expect(res.items[0]).toMatchObject({
        ref: saved.work.id,
        title: 'Same Book',
        editionCount: 52,
        libraryStatus: saved.status,
      });
    });

    it('prefers the shown work when several merged works are saved', async () => {
      fresh();
      const shown = await inLibrary(userId, { addedAt: new Date('2025-01-01T00:00:00Z') });
      const other = await inLibrary(userId, { addedAt: new Date('2026-01-01T00:00:00Z') });
      provider.canned.set('q', [row(shown.key, 'Same Book', 50), row(other.key, 'Same book', 2)]);

      const res = await service.searchBooks(userId, { q: 'q' });

      expect(res.items[0]?.ref).toBe(shown.work.id);
    });

    it('runs one books query and one read-count query per search', async () => {
      fresh();
      const repo = new LibraryStatusRepository(prisma);
      const readingRepo = new ReadingRepository(prisma);
      const books = vi.spyOn(repo, 'findActive');
      const counts = vi.spyOn(readingRepo, 'countFinished');
      const spied = new CatalogService(
        new CatalogRepository(prisma),
        provider,
        new LibraryStatusService(repo, new ReadingService(readingRepo)),
      );
      const first = await inLibrary(userId);
      const second = await inLibrary(userId);
      provider.canned.set('q', [row(first.key, 'One'), row(second.key, 'Two', 1)]);

      await spied.searchBooks(userId, { q: 'q' });

      expect(books).toHaveBeenCalledTimes(1);
      expect(counts).toHaveBeenCalledTimes(1);
    });

    it('gives a saved work its status by id and by ol ref, and null to others', async () => {
      fresh();
      const mine = await inLibrary(userId);

      expect((await service.getWork(userId, mine.work.id)).libraryStatus).toEqual(mine.status);
      expect((await service.getWork(userId, `ol:${mine.key}`)).libraryStatus).toEqual(mine.status);
      expect((await service.getWork(otherId, mine.work.id)).libraryStatus).toBeNull();
    });

    it('fills the works of a provider author and of a provider series', async () => {
      fresh();
      const mine = await inLibrary(userId);
      const authorKey = uniqueKey('A');
      provider.addAuthor({
        olAuthorKey: authorKey,
        name: 'Juan Rulfo',
        bio: null,
        birthYear: null,
        deathYear: null,
        photoUrl: null,
      });
      provider.canned.set(`author_key:${authorKey}`, [row(mine.key, 'Mine')]);
      provider.addSeries(`${TAG} saga`, [row(mine.key, 'Mine')]);

      const author = await service.getAuthor(userId, `ol:${authorKey}`);
      const series = await service.getSeries(userId, `ol:${TAG} saga`);

      expect(author.works[0]).toMatchObject({ ref: mine.work.id, libraryStatus: mine.status });
      expect(series.works[0]).toMatchObject({
        ref: mine.work.id,
        position: null,
        libraryStatus: mine.status,
      });
    });

    it('fills the works of a local author and of a local series by work id', async () => {
      fresh();
      const author = await prisma.author.create({ data: { id: uuidv7(), name: `${TAG} local` } });
      const series = await prisma.series.create({ data: { id: uuidv7(), name: `${TAG} local` } });
      const mine = await inLibrary(userId, {
        olWorkKey: null,
        authorId: author.id,
        seriesId: series.id,
      });

      expect((await service.getAuthor(userId, author.id)).works[0]?.libraryStatus).toEqual(
        mine.status,
      );
      expect((await service.getSeries(userId, series.id)).works[0]?.libraryStatus).toEqual(
        mine.status,
      );
      expect((await service.getSeries(otherId, series.id)).works[0]?.libraryStatus).toBeNull();
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

    it('keeps at most 30 genres and 5 authors', async () => {
      fresh();
      const keys = ['OL1A', 'OL2A', 'OL3A', 'OL4A', 'OL5A', 'OL6A'];
      provider.addWork(
        olWork(
          keys,
          Array.from({ length: 40 }, (_, i) => `s${i}`),
        ),
      );
      for (const key of keys) provider.addAuthor(olAuthor(key, key));

      const work = await service.getWork(userId, 'ol:OL1W');
      expect(work.genres).toHaveLength(30);
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
      translatedFrom: null,
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

    it('puts well-described editions before bare stubs and keeps ties in provider order', async () => {
      fresh();
      seedWork();
      provider.addEdition(ed('OL3M', null)).addEdition({
        ...ed('OL4M', 'es'),
        coverUrl: 'https://covers.openlibrary.org/b/id/1-M.jpg',
        isbn13: '9788437604947',
        publisher: 'Cátedra',
        pageCount: 128,
        publishYear: 1955,
      });
      const refs = (await service.getEditions(userId, 'ol:OL1W')).map((e) => e.ref);
      // OL4M is complete. OL1M and OL2M score 1 (language), OL3M scores 0.
      expect(refs).toEqual(['ol:OL4M', 'ol:OL1M', 'ol:OL2M', 'ol:OL3M']);
    });

    it('flags the original-language editions from translated_from and keeps the flag under a language filter', async () => {
      fresh();
      seedWork();
      provider
        .addEdition({ ...ed('OL5M', 'ca'), translatedFrom: 'en' })
        .addEdition({ ...ed('OL6M', 'en'), publishYear: 1996 });
      const flags = async (language?: string) =>
        (await service.getEditions(userId, 'ol:OL1W', language)).map((e) => [
          e.ref,
          e.isOriginalLanguage,
        ]);
      // ed() gives OL1M "es" and OL2M "en". Only English is the original language.
      expect(await flags()).toEqual(
        expect.arrayContaining([
          ['ol:OL1M', false],
          ['ol:OL2M', true],
          ['ol:OL5M', false],
          ['ol:OL6M', true],
        ]),
      );
      // The filter does not change the flag: the original language comes from the full list.
      expect(await flags('ca')).toEqual([['ol:OL5M', false]]);
      expect(await flags('en')).toEqual(
        expect.arrayContaining([
          ['ol:OL2M', true],
          ['ol:OL6M', true],
        ]),
      );
    });

    it('derives the original language of a local work from its oldest dated edition', async () => {
      fresh();
      const work = await prisma.work.create({ data: { id: uuidv7(), title: `${TAG} local` } });
      const add = (language: string, publishYear: number) =>
        prisma.edition.create({
          data: { id: uuidv7(), workId: work.id, title: `${TAG} e`, language, publishYear },
        });
      await add('en', 1994);
      await add('es', 1955);
      const list = await service.getEditions(userId, work.id);
      expect(list.map((e) => [e.language, e.isOriginalLanguage])).toEqual([
        ['es', true],
        ['en', false],
      ]);
      expect(
        (await service.getEditions(userId, work.id, 'en')).map((e) => e.isOriginalLanguage),
      ).toEqual([false]);
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

      const author = await service.getAuthor(userId, 'ol:OL1A');
      expect(author).toMatchObject({
        ref: 'ol:OL1A',
        name: 'Juan Rulfo',
        bio: 'Mexican writer.',
        birthYear: 1917,
        deathYear: 1986,
      });
      expect(author.works.map((w) => w.title)).toEqual(['Early', 'Late', 'Unknown']);
      // Three pages, most editions first (the fake ignores the sort, the service sends it).
      expect(provider.searches).toEqual([
        { query: 'author_key:OL1A', page: 1, sort: 'editions' },
        { query: 'author_key:OL1A', page: 2, sort: 'editions' },
        { query: 'author_key:OL1A', page: 3, sort: 'editions' },
      ]);
    });

    it('reads several pages, drops bundles and stubs, and orders by release year', async () => {
      fresh();
      provider.addAuthor(olAuthor);
      const page = (n: number): WorkSearchResult[] =>
        n === 1
          ? [
              // First edition dated 2011 by mistake, typical year 2020.
              {
                ...searchResult('OL1W', 'Rhythm of War'),
                firstPublishYear: 2011,
                typicalYear: 2020,
              },
              {
                ...searchResult('OL2W', 'Words of Radiance'),
                firstPublishYear: 2012,
                typicalYear: 2014,
              },
            ]
          : n === 2
            ? [
                {
                  ...searchResult('OL3W', 'The Way of Kings'),
                  firstPublishYear: 2010,
                  typicalYear: 2010,
                },
                { ...searchResult('OL4W', 'Six Books Collection Set'), editionCount: 3 },
                { ...searchResult('OL5W', 'Study guide'), editionCount: 1 },
              ]
            : [{ ...searchResult('OL1W', 'Rhythm of War'), typicalYear: 2020 }];
      provider.searchWorks = (_query, p) => Promise.resolve(page(p));

      const author = await service.getAuthor(userId, 'ol:OL1A');
      expect(author.works.map((w) => w.title)).toEqual([
        'The Way of Kings',
        'Words of Radiance',
        'Rhythm of War',
      ]);
    });

    it('still answers when a later page fails, and fails when the first page fails', async () => {
      fresh();
      provider.addAuthor(olAuthor);
      provider.searchWorks = (_query, p) =>
        p === 1
          ? Promise.resolve([searchResult('OL1W', 'First')])
          : Promise.reject(new Error('boom'));
      expect((await service.getAuthor(userId, 'ol:OL1A')).works.map((w) => w.title)).toEqual([
        'First',
      ]);

      provider.unavailable = true;
      provider.searchWorks = InMemoryCatalogProvider.prototype.searchWorks.bind(provider);
      await failsWith(service.getAuthor(userId, 'ol:OL1A'), 503, ErrorCode.CATALOG_UNAVAILABLE);
    });

    it('turns a Markdown biography into plain text', async () => {
      fresh();
      provider.addAuthor({
        ...olAuthor,
        olAuthorKey: 'OL5A',
        bio: '**Brandon Sanderson** is [an author](https://example.org).\r\n\r\n----------\r\nSource: x',
      });
      expect((await service.getAuthor(userId, 'ol:OL5A')).bio).toBe(
        'Brandon Sanderson is an author.',
      );
    });

    it('serves a local author with a key through the provider and returns the local id', async () => {
      fresh();
      const local = await prisma.author.create({
        data: { id: uuidv7(), name: `${TAG} rulfo`, olAuthorKey: 'OL7A' },
      });
      provider.canned.set('author_key:OL7A', [searchResult('OL1W', 'Pedro Páramo')]);

      const byId = await service.getAuthor(userId, local.id);
      expect(byId.ref).toBe(local.id);
      expect(byId.works.map((w) => w.title)).toEqual(['Pedro Páramo']);
      expect((await service.getAuthor(userId, 'ol:OL7A')).ref).toBe(local.id);
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

      const res = await service.getAuthor(userId, local.id);
      expect(res.works.map((w) => w.title)).toEqual([`${TAG} public`]);
      expect(provider.searches).toEqual([]);
    });

    it('maps unknown authors, bad refs and outages', async () => {
      fresh();
      await failsWith(service.getAuthor(userId, 'ol:OL404A'), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getAuthor(userId, uuidv7()), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getAuthor(userId, 'ol:OL1W'), 400, ErrorCode.INVALID_REF);
      provider.addAuthor(olAuthor);
      provider.unavailable = true;
      await failsWith(service.getAuthor(userId, 'ol:OL1A'), 503, ErrorCode.CATALOG_UNAVAILABLE);
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

      const res = await service.getSeries(userId, series.id);
      expect(res.name).toBe(`${TAG} s`);
      expect(res.works.map((w) => [w.title.replace(`${TAG} `, ''), w.position])).toEqual([
        ['half', 1.5],
        ['two', 2],
        ['none', null],
      ]);
    });

    it('returns 404 for an unknown id and 400 for an id that is neither a UUID nor ol:<name>', async () => {
      fresh();
      await failsWith(service.getSeries(userId, uuidv7()), 404, ErrorCode.CATALOG_NOT_FOUND);
      await failsWith(service.getSeries(userId, 'not-a-uuid'), 400, ErrorCode.INVALID_REF);
      await failsWith(service.getSeries(userId, 'ol:'), 400, ErrorCode.INVALID_REF);
      await failsWith(
        service.getSeries(userId, `ol:${'a'.repeat(121)}`),
        400,
        ErrorCode.INVALID_REF,
      );
    });

    describe('derived from Open Library subjects', () => {
      const entry = (key: string, title: string, year: number, editions: number) => ({
        ...searchResult(key, title),
        firstPublishYear: year,
        editionCount: editions,
      });

      it('lists the works of a series from a subject search, with null positions', async () => {
        fresh();
        provider.addSeries('A Song of Ice and Fire', [
          entry('OL2W', 'A Clash of Kings', 1998, 76),
          entry('OL1W', 'A Game of Thrones', 1996, 136),
        ]);
        const res = await service.getSeries(userId, 'ol:A Song of Ice and Fire');
        // The subject search is trusted. The series field and the title search add candidates.
        expect(provider.searches.map((s) => s.query)).toEqual([
          'subject:"series:A Song of Ice and Fire"',
          'series:"A Song of Ice and Fire"',
          'title:"A Song of Ice and Fire" author:"Juan Rulfo"',
        ]);
        expect(res.id).toBe('ol:A Song of Ice and Fire');
        expect(res.name).toBe('A Song of Ice and Fire');
        // Ordered by release year, whatever the order Open Library answered in.
        expect(res.works.map((w) => [w.ref, w.position])).toEqual([
          ['ol:OL1W', null],
          ['ol:OL2W', null],
        ]);
      });

      it('completes a half-tagged series from the series field and the title search', async () => {
        fresh();
        // Like "The Stormlight Archive": 2 books carry the subject, the rest are found by text.
        provider.addSeries('Stormlight Archive', [
          entry('OL1W', 'The Way of Kings', 2010, 30),
          entry('OL7W', 'Wind and Truth', 2024, 6),
        ]);
        provider.addQueryResults('series:"Stormlight Archive"', [
          entry('OL1W', 'The Way of Kings', 2010, 30),
          entry('OL5W', 'Rhythm of War', 2020, 15),
          {
            ...entry('OL90W', 'Stormlight Archive Series 6 Books Collection Set', 2020, 1),
          },
        ]);
        provider.addQueryResults('title:"Stormlight Archive" author:"Juan Rulfo"', [
          entry('OL2W', 'Words of Radiance', 2012, 23),
          entry('OL3W', 'Oathbringer', 2017, 18),
          entry('OL4W', 'Dawnshard', 2020, 12),
          entry('OL60W', 'Oathbringer part 1', 2017, 5),
          entry('OL61W', 'The Way of Kings, Part One', 2011, 3),
          {
            ...entry('OL62W', 'Someone Elses Book', 2012, 40),
            authors: [{ olAuthorKey: 'OL9A', name: 'Other' }],
          },
        ]);
        const res = await service.getSeries(userId, 'ol:Stormlight Archive');
        expect(res.works.map((w) => w.title).sort()).toEqual(
          [
            'Dawnshard',
            'Oathbringer',
            'Rhythm of War',
            'The Way of Kings',
            'Wind and Truth',
            'Words of Radiance',
          ].sort(),
        );
        expect(res.works.every((w) => w.position === null)).toBe(true);
      });

      it('still answers from the subject search when the other two searches fail', async () => {
        fresh();
        provider.addSeries('Saga', [entry('OL1W', 'First', 2001, 10)]);
        const original = provider.searchWorks.bind(provider);
        provider.searchWorks = (query, page) =>
          query.startsWith('subject:') ? original(query, page) : Promise.reject(new Error('boom'));
        const res = await service.getSeries(userId, 'ol:Saga');
        expect(res.works.map((w) => w.ref)).toEqual(['ol:OL1W']);
      });

      it('builds a series from the series field alone when no work has the subject', async () => {
        fresh();
        provider.addQueryResults('series:"Saga"', [
          entry('OL1W', 'First', 2001, 12),
          entry('OL2W', 'Second', 2002, 9),
        ]);
        const res = await service.getSeries(userId, 'ol:Saga');
        expect(res.works.map((w) => w.ref)).toEqual(['ol:OL1W', 'ol:OL2W']);
      });

      it('merges duplicates and drops the 1-edition tail', async () => {
        fresh();
        provider.addSeries('Saga', [
          entry('OL1W', 'First', 2001, 10),
          entry('OL2W', 'First', 2001, 5),
          entry('OL3W', 'Study guide', 2005, 1),
        ]);
        const res = await service.getSeries(userId, 'ol:Saga');
        expect(res.works.map((w) => w.ref)).toEqual(['ol:OL1W']);
      });

      it('returns 404 when the subject search finds nothing', async () => {
        fresh();
        await failsWith(service.getSeries(userId, 'ol:Unknown'), 404, ErrorCode.CATALOG_NOT_FOUND);
      });

      it('returns 503 when Open Library is down', async () => {
        fresh();
        provider.unavailable = true;
        await failsWith(service.getSeries(userId, 'ol:Saga'), 503, ErrorCode.CATALOG_UNAVAILABLE);
      });
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
      translatedFrom: null,
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
