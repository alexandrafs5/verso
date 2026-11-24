import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { CatalogRepository } from './catalog.repository.js';

const TAG = `cr${Date.now().toString(36)}`;

describe('CatalogRepository (real Postgres)', () => {
  let prisma: PrismaService;
  let repo: CatalogRepository;
  let close: () => Promise<void>;

  const work = (extra: Record<string, unknown> = {}) =>
    prisma.work.create({ data: { id: uuidv7(), title: `${TAG} work`, ...extra } });
  const author = (extra: Record<string, unknown> = {}) =>
    prisma.author.create({ data: { id: uuidv7(), name: `${TAG} author`, ...extra } });
  const link = (workId: string, authorId: string, position = 0) =>
    prisma.workAuthor.create({ data: { workId, authorId, position } });

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
    prisma = ctx.get(PrismaService);
    repo = new CatalogRepository(prisma);
    close = () => ctx.close();
  });

  afterEach(async () => {
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.author.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.genre.deleteMany({ where: { slug: { startsWith: TAG } } });
    await prisma.series.deleteMany({ where: { name: { startsWith: TAG } } });
  });

  afterAll(async () => {
    await close();
  });

  it('finds a work by id and by olWorkKey with authors in order, genres and series', async () => {
    const key = `OL${Date.now()}W`;
    const series = await prisma.series.create({ data: { id: uuidv7(), name: `${TAG} s` } });
    const genre = await prisma.genre.create({
      data: { id: uuidv7(), slug: `${TAG}-g`, name: 'Fiction' },
    });
    const w = await work({ olWorkKey: key, seriesId: series.id, seriesPosition: 1.5 });
    const a1 = await author({ name: `${TAG} second` });
    const a2 = await author({ name: `${TAG} first` });
    await link(w.id, a1.id, 1);
    await link(w.id, a2.id, 0);
    await prisma.workGenre.create({ data: { workId: w.id, genreId: genre.id } });

    const byId = await repo.findWorkById(w.id);
    expect(byId?.authors.map((x) => x.author.name)).toEqual([`${TAG} first`, `${TAG} second`]);
    expect(byId?.genres.map((x) => x.genre.name)).toEqual(['Fiction']);
    expect(byId?.series?.name).toBe(`${TAG} s`);
    expect(Number(byId?.seriesPosition)).toBe(1.5);

    expect((await repo.findWorkByOlKey(key))?.id).toBe(w.id);
    expect(await repo.findWorkByOlKey('OL1W')).toBeNull();
    expect(await repo.findWorkById(uuidv7())).toBeNull();
  });

  it('lists editions of a work, filtered by language, oldest first with unknown years last', async () => {
    const w = await work();
    const ed = (extra: Record<string, unknown>) =>
      prisma.edition.create({ data: { id: uuidv7(), workId: w.id, title: `${TAG} ed`, ...extra } });
    await ed({ publishYear: null, language: 'es' });
    await ed({ publishYear: 2010, language: 'es' });
    await ed({ publishYear: 1990, language: 'en' });

    const all = await repo.findEditionsByWork(w.id);
    expect(all.map((e) => e.publishYear)).toEqual([1990, 2010, null]);
    const es = await repo.findEditionsByWork(w.id, 'es');
    expect(es.map((e) => e.publishYear)).toEqual([2010, null]);
    expect(await repo.findEditionsByWork(uuidv7())).toEqual([]);
  });

  it('finds an author by id and by olAuthorKey', async () => {
    const key = `OL${Date.now()}A`;
    const a = await author({ olAuthorKey: key });
    expect((await repo.findAuthorById(a.id))?.id).toBe(a.id);
    expect((await repo.findAuthorByOlKey(key))?.id).toBe(a.id);
    expect(await repo.findAuthorByOlKey('OL1A')).toBeNull();
  });

  it('lists public works of an author by year, unknown years last, without private works', async () => {
    const a = await author();
    const late = await work({ title: `${TAG} late`, firstPublishYear: 2000 });
    const early = await work({ title: `${TAG} early`, firstPublishYear: 1950 });
    const unknown = await work({ title: `${TAG} unknown` });
    const hidden = await work({ title: `${TAG} hidden`, catalogStatus: 'PRIVATE' });
    for (const w of [late, early, unknown, hidden]) await link(w.id, a.id);

    const works = await repo.findPublicWorksByAuthor(a.id);
    expect(works.map((w) => w.id)).toEqual([early.id, late.id, unknown.id]);
    expect(works[0]?.authors[0]?.author.id).toBe(a.id);
  });

  it('returns a series with public works ordered by position, unknown last', async () => {
    const s = await prisma.series.create({ data: { id: uuidv7(), name: `${TAG} s` } });
    const two = await work({ title: `${TAG} two`, seriesId: s.id, seriesPosition: 2 });
    const half = await work({ title: `${TAG} half`, seriesId: s.id, seriesPosition: 1.5 });
    const none = await work({ title: `${TAG} none`, seriesId: s.id });
    await work({ title: `${TAG} hidden`, seriesId: s.id, catalogStatus: 'PRIVATE' });

    const found = await repo.findSeriesById(s.id);
    expect(found?.works.map((w) => w.id)).toEqual([half.id, two.id, none.id]);
    expect(Number(found?.works[0]?.seriesPosition)).toBe(1.5);
    expect(await repo.findSeriesById(uuidv7())).toBeNull();
  });
});
