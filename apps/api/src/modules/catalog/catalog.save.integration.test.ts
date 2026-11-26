import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ErrorCode } from '@verso/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type {
  ExternalAuthor,
  ExternalEdition,
  ExternalWork,
} from '../../infra/catalog/catalog-provider.js';
import { InMemoryCatalogProvider } from '../../infra/catalog/in-memory-catalog.provider.js';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { LibraryStatusRepository } from '../library/library-status.repository.js';
import { LibraryStatusService } from '../library/library-status.service.js';
import { ReadingRepository } from '../reading/reading.repository.js';
import { ReadingService } from '../reading/reading.service.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';

const TAG = `cv${Date.now().toString(36)}`;
// Open Library keys no other test file uses, because the columns are unique across the database.
const SEED = `${Date.now()}3`;
let counter = 0;
const uniqueKey = (suffix: 'W' | 'M' | 'A') => `OL${SEED}${counter++}${suffix}`;
const uniqueIsbn = () => `${SEED}${counter++}`.slice(-13);

describe('CatalogService saving for the library (real Postgres, fake provider)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;
  let provider: InMemoryCatalogProvider;
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

  const cleanCatalog = async () => {
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.author.deleteMany({ where: { name: { startsWith: TAG } } });
  };

  afterEach(cleanCatalog);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await close();
  });

  const fresh = () => {
    provider = new InMemoryCatalogProvider();
    service = new CatalogService(
      new CatalogRepository(prisma),
      provider,
      new LibraryStatusService(
        new LibraryStatusRepository(prisma),
        new ReadingService(new ReadingRepository(prisma)),
      ),
    );
  };

  const edition = (workKey: string, extra: Partial<ExternalEdition> = {}): ExternalEdition => ({
    olEditionKey: uniqueKey('M'),
    olWorkKey: workKey,
    title: `${TAG} edition`,
    isbn10: null,
    isbn13: null,
    publisher: 'Cátedra',
    publishYear: 1999,
    language: 'es',
    pageCount: 124,
    format: 'PAPERBACK',
    coverUrl: null,
    translatedFrom: null,
    ...extra,
  });

  /** An Open Library work the fake knows, with one author. */
  const olWork = (extra: Partial<ExternalWork> = {}) => {
    const key = uniqueKey('W');
    const author: ExternalAuthor = {
      olAuthorKey: uniqueKey('A'),
      name: `${TAG} Juan Rulfo`,
      bio: '**Mexican** writer.',
      birthYear: 1917,
      deathYear: 1986,
      photoUrl: null,
    };
    provider.addAuthor(author).addWork({
      olWorkKey: key,
      title: `${TAG} Pedro Páramo`,
      subtitle: null,
      description: '**A novel.**',
      firstPublishYear: 1955,
      coverUrl: null,
      authorKeys: [author.olAuthorKey],
      subjects: ['Fiction', 'Fantasy', 'series:Comala'],
      ...extra,
    });
    return { key, author };
  };

  const add = async (ref: string, editionRef?: string, locale = 'en', user = userId) =>
    service.saveForLibrary(await service.findWorkForLibrary(user, ref), { editionRef, locale });

  const savedWork = (olWorkKey: string) =>
    prisma.work.findUnique({
      where: { olWorkKey },
      include: {
        authors: { include: { author: true }, orderBy: { position: 'asc' } },
        genres: { include: { genre: true } },
        editions: true,
      },
    });

  const failsWith = (promise: Promise<unknown>, code: string) =>
    expect(promise).rejects.toMatchObject({ code });

  it('saves the work, its authors, its mapped genres and the edition', async () => {
    fresh();
    const { key, author } = olWork();
    const chosen = edition(key);
    provider.addEdition(chosen);

    const saved = await add(`ol:${key}`);

    const work = await savedWork(key);
    expect(work).toMatchObject({
      id: saved.workId,
      title: `${TAG} Pedro Páramo`,
      description: 'A novel.',
      firstPublishYear: 1955,
      source: 'OPEN_LIBRARY',
      catalogStatus: 'PUBLIC',
      seriesId: null,
    });
    expect(work?.authors.map((a) => [a.position, a.author.olAuthorKey, a.author.bio])).toEqual([
      [0, author.olAuthorKey, 'Mexican writer.'],
    ]);
    expect(work?.genres.map((g) => g.genre.slug).sort()).toEqual(['fantasy', 'fiction']);
    expect(work?.editions).toMatchObject([
      { id: saved.editionId, olEditionKey: chosen.olEditionKey, pageCount: 124 },
    ]);
    expect(saved.editionRef).toBe(`ol:${chosen.olEditionKey}`);
  });

  it('saves at most 5 authors and drops one Open Library does not know', async () => {
    fresh();
    const keys = Array.from({ length: 6 }, () => uniqueKey('A'));
    const { key } = olWork({ authorKeys: ['OL0A', ...keys, keys[0] as string] });
    for (const olAuthorKey of keys) {
      provider.addAuthor({
        olAuthorKey,
        name: `${TAG} ${olAuthorKey}`,
        bio: null,
        birthYear: null,
        deathYear: null,
        photoUrl: null,
      });
    }
    provider.addEdition(edition(key));

    await add(`ol:${key}`);

    const work = await savedWork(key);
    expect(work?.authors.map((a) => a.author.olAuthorKey)).toEqual(keys.slice(0, 4));
  });

  describe('default edition', () => {
    const three = () => {
      const { key } = olWork();
      const french = edition(key, { language: 'fr' });
      const english = edition(key, { language: 'en' });
      const spanish = edition(key, { language: 'es', translatedFrom: null });
      return { key, french, english, spanish };
    };

    it('takes the original-language edition', async () => {
      fresh();
      const { key, french, english, spanish } = three();
      const translated = { ...english, translatedFrom: 'es' };
      for (const e of [french, translated, spanish]) provider.addEdition(e);

      expect((await add(`ol:${key}`, undefined, 'en')).editionRef).toBe(
        `ol:${spanish.olEditionKey}`,
      );
    });

    it('else takes the language of the user, else the first ranked one', async () => {
      fresh();
      const a = olWork().key;
      // No year and no translation data: there is no original language.
      const french = edition(a, { language: 'fr', publishYear: null });
      const english = edition(a, { language: 'en', publishYear: null });
      provider.addEdition(french).addEdition(english);
      expect((await add(`ol:${a}`, undefined, 'en')).editionRef).toBe(`ol:${english.olEditionKey}`);

      const b = olWork().key;
      const bare = edition(b, { language: 'de', publishYear: null, publisher: null });
      const complete = edition(b, {
        language: 'it',
        publishYear: null,
        coverUrl: 'https://example.org/c.jpg',
      });
      provider.addEdition(bare).addEdition(complete);
      expect((await add(`ol:${b}`, undefined, 'en')).editionRef).toBe(
        `ol:${complete.olEditionKey}`,
      );
    });
  });

  it('shares the work and the edition between two adds, without changing them', async () => {
    fresh();
    const { key } = olWork();
    const chosen = edition(key);
    provider.addEdition(chosen);
    const first = await add(`ol:${key}`);
    await prisma.work.update({
      where: { id: first.workId },
      data: { description: 'Edited by hand.' },
    });

    const second = await add(`ol:${key}`, `ol:${chosen.olEditionKey}`, 'es', otherId);

    expect(second).toEqual(first);
    expect((await savedWork(key))?.description).toBe('Edited by hand.');
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(1);
  });

  it('keeps one row per key under concurrent adds', async () => {
    fresh();
    const { key, author } = olWork();
    const chosen = edition(key, { isbn13: uniqueIsbn() });
    provider.addEdition(chosen);

    const results = await Promise.all(Array.from({ length: 4 }, () => add(`ol:${key}`)));

    expect(new Set(results.map((r) => r.editionId)).size).toBe(1);
    expect(await prisma.work.count({ where: { olWorkKey: key } })).toBe(1);
    expect(await prisma.author.count({ where: { olAuthorKey: author.olAuthorKey } })).toBe(1);
    expect(await prisma.edition.count({ where: { olEditionKey: chosen.olEditionKey } })).toBe(1);
    expect((await savedWork(key))?.editions[0]?.isbn13).toBe(chosen.isbn13);
  });

  it('adds a second edition to a saved work', async () => {
    fresh();
    const { key } = olWork();
    const first = edition(key);
    const second = edition(key);
    provider.addEdition(first).addEdition(second);
    await add(`ol:${key}`, `ol:${first.olEditionKey}`);

    await add(`ol:${key}`, `ol:${second.olEditionKey}`);

    expect((await savedWork(key))?.editions).toHaveLength(2);
  });

  it('saves an edition whose ISBN-13 is taken without it', async () => {
    fresh();
    const isbn13 = uniqueIsbn();
    const a = olWork().key;
    const b = olWork().key;
    provider.addEdition(edition(a, { isbn13 })).addEdition(edition(b, { isbn13 }));
    await add(`ol:${a}`);

    const saved = await add(`ol:${b}`);

    expect(await prisma.edition.findUnique({ where: { id: saved.editionId } })).toMatchObject({
      isbn13: null,
    });
  });

  it('rejects an edition of another work and writes nothing', async () => {
    fresh();
    const a = olWork().key;
    const b = olWork().key;
    const ofA = edition(a);
    provider.addEdition(ofA).addEdition(edition(b));

    await failsWith(add(`ol:${b}`, `ol:${ofA.olEditionKey}`), ErrorCode.EDITION_NOT_IN_WORK);
    await failsWith(add(`ol:${b}`, uuidv7()), ErrorCode.EDITION_NOT_IN_WORK);
    expect(await savedWork(b)).toBeNull();
  });

  it('rejects an edition key already saved under another work', async () => {
    fresh();
    const a = olWork().key;
    const shared = edition(a);
    provider.addEdition(shared);
    await add(`ol:${a}`);
    const b = olWork().key;
    // Open Library moved the edition: the list of `b` now has it too.
    provider.addEdition({ ...shared, olWorkKey: b });

    await failsWith(add(`ol:${b}`, `ol:${shared.olEditionKey}`), ErrorCode.EDITION_NOT_IN_WORK);
    expect(await savedWork(b)).toBeNull();
  });

  it('writes nothing for a work without editions', async () => {
    fresh();
    const { key } = olWork();

    await failsWith(add(`ol:${key}`), ErrorCode.NO_EDITION_AVAILABLE);
    expect(await savedWork(key)).toBeNull();
  });

  it('writes nothing during an outage, unless the edition is already saved', async () => {
    fresh();
    const { key } = olWork();
    const chosen = edition(key);
    provider.addEdition(chosen);
    provider.unavailable = true;
    await failsWith(add(`ol:${key}`), ErrorCode.CATALOG_UNAVAILABLE);
    expect(await savedWork(key)).toBeNull();

    provider.unavailable = false;
    const saved = await add(`ol:${key}`);
    provider.unavailable = true;

    expect(await add(`ol:${key}`, `ol:${chosen.olEditionKey}`)).toEqual(saved);
    expect(await add(saved.workId, saved.editionId)).toEqual(saved);
    await failsWith(add(`ol:${key}`), ErrorCode.CATALOG_UNAVAILABLE);
  });

  describe('manual works', () => {
    const manual = async (catalogStatus: 'PUBLIC' | 'PRIVATE' = 'PRIVATE') =>
      prisma.work.create({
        data: {
          id: uuidv7(),
          title: `${TAG} manual`,
          source: 'MANUAL',
          catalogStatus,
          createdById: userId,
        },
      });

    it('uses a saved edition without calling the provider', async () => {
      fresh();
      provider.unavailable = true;
      const work = await manual();
      const saved = await prisma.edition.create({
        data: { id: uuidv7(), workId: work.id, title: `${TAG} ed` },
      });

      const expected = { workId: work.id, editionId: saved.id, editionRef: saved.id };
      expect(await add(work.id)).toEqual(expected);
      expect(await add(work.id, saved.id)).toEqual(expected);
      await failsWith(add(work.id, 'ol:OL1M'), ErrorCode.EDITION_NOT_IN_WORK);
    });

    it('has no edition to add when none is saved', async () => {
      fresh();
      await failsWith(add((await manual()).id), ErrorCode.NO_EDITION_AVAILABLE);
    });

    it('is not found for another user', async () => {
      fresh();
      const work = await manual();
      await failsWith(service.findWorkForLibrary(otherId, work.id), ErrorCode.CATALOG_NOT_FOUND);
    });
  });

  it('rejects bad refs and unknown works', async () => {
    fresh();
    await failsWith(service.findWorkForLibrary(userId, 'ol:OL1A'), ErrorCode.INVALID_REF);
    await failsWith(service.findWorkForLibrary(userId, uuidv7()), ErrorCode.CATALOG_NOT_FOUND);
    await failsWith(add(`ol:${uniqueKey('W')}`), ErrorCode.CATALOG_NOT_FOUND);
  });
});
