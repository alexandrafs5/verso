import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';

const TAG = `cs${Date.now().toString(36)}`;

describe('Catalog schema (real Postgres)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;

  const work = (extra: Record<string, unknown> = {}) =>
    prisma.work.create({ data: { id: uuidv7(), title: `${TAG} work`, ...extra } });
  const edition = (workId: string, extra: Record<string, unknown> = {}) =>
    prisma.edition.create({ data: { id: uuidv7(), workId, title: `${TAG} ed`, ...extra } });
  const author = (extra: Record<string, unknown> = {}) =>
    prisma.author.create({ data: { id: uuidv7(), name: `${TAG} author`, ...extra } });
  const genre = (slug = `${TAG}-${uuidv7()}`) =>
    prisma.genre.create({ data: { id: uuidv7(), slug, name: slug } });
  const series = (extra: Record<string, unknown> = {}) =>
    prisma.series.create({ data: { id: uuidv7(), name: `${TAG} series`, ...extra } });
  const user = () =>
    prisma.user.create({
      data: { id: uuidv7(), email: `${TAG}-${uuidv7()}@example.com`, name: `${TAG} user` },
    });

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
    prisma = ctx.get(PrismaService);
    close = () => ctx.close();
  });

  afterEach(async () => {
    await prisma.work.updateMany({
      where: { title: { startsWith: TAG } },
      data: { mergedIntoId: null },
    });
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
    await prisma.author.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.genre.deleteMany({ where: { slug: { startsWith: TAG } } });
    await prisma.series.deleteMany({ where: { name: { startsWith: TAG } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
  });

  afterAll(async () => {
    await close();
  });

  it('applies defaults', async () => {
    const w = await work();
    expect(w.source).toBe('OPEN_LIBRARY');
    expect(w.catalogStatus).toBe('PUBLIC');
    expect(w.reviewStatus).toBe('NONE');
    const e = await edition(w.id);
    expect(e.format).toBe('OTHER');
  });

  it('enforces unique olWorkKey but allows many nulls', async () => {
    const key = `OL${Date.now()}W`;
    await work({ olWorkKey: key });
    await expect(work({ olWorkKey: key })).rejects.toThrow();
    await work();
    await work();
  });

  it('enforces unique isbn13 and olEditionKey, allows many nulls and repeated isbn10', async () => {
    const w = await work();
    const isbn13 = `97${Date.now()}`.slice(0, 13);
    const olKey = `OL${Date.now()}M`;
    await edition(w.id, { isbn13, olEditionKey: olKey, isbn10: '0000000001' });
    await expect(edition(w.id, { isbn13 })).rejects.toThrow();
    await expect(edition(w.id, { olEditionKey: olKey })).rejects.toThrow();
    await edition(w.id, { isbn10: '0000000001' });
    await edition(w.id);
    await edition(w.id);
  });

  it('enforces unique author key, genre slug and series key', async () => {
    const key = `OL${Date.now()}A`;
    await author({ olAuthorKey: key });
    await expect(author({ olAuthorKey: key })).rejects.toThrow();
    const g = await genre();
    await expect(genre(g.slug)).rejects.toThrow();
    const sKey = `${TAG}-series`;
    await series({ olSeriesKey: sKey });
    await expect(series({ olSeriesKey: sKey })).rejects.toThrow();
  });

  it('rejects duplicate WorkAuthor and WorkGenre pairs', async () => {
    const w = await work();
    const a = await author();
    const g = await genre();
    await prisma.workAuthor.create({ data: { workId: w.id, authorId: a.id } });
    await expect(
      prisma.workAuthor.create({ data: { workId: w.id, authorId: a.id } }),
    ).rejects.toThrow();
    await prisma.workGenre.create({ data: { workId: w.id, genreId: g.id } });
    await expect(
      prisma.workGenre.create({ data: { workId: w.id, genreId: g.id } }),
    ).rejects.toThrow();
  });

  it('deleting a work cascades to editions and join rows', async () => {
    const w = await work();
    const a = await author();
    const g = await genre();
    const e = await edition(w.id);
    await prisma.workAuthor.create({ data: { workId: w.id, authorId: a.id } });
    await prisma.workGenre.create({ data: { workId: w.id, genreId: g.id } });

    await prisma.work.delete({ where: { id: w.id } });

    expect(await prisma.edition.count({ where: { id: e.id } })).toBe(0);
    expect(await prisma.workAuthor.count({ where: { workId: w.id } })).toBe(0);
    expect(await prisma.workGenre.count({ where: { workId: w.id } })).toBe(0);
    expect(await prisma.author.count({ where: { id: a.id } })).toBe(1);
  });

  it('restricts deleting an author or genre still used by a work', async () => {
    const w = await work();
    const a = await author();
    const g = await genre();
    await prisma.workAuthor.create({ data: { workId: w.id, authorId: a.id } });
    await prisma.workGenre.create({ data: { workId: w.id, genreId: g.id } });
    await expect(prisma.author.delete({ where: { id: a.id } })).rejects.toThrow();
    await expect(prisma.genre.delete({ where: { id: g.id } })).rejects.toThrow();
  });

  it('deleting a series nulls seriesId and keeps seriesPosition', async () => {
    const s = await series();
    const w = await work({ seriesId: s.id, seriesPosition: '1.5' });
    await prisma.series.delete({ where: { id: s.id } });
    const after = await prisma.work.findUniqueOrThrow({ where: { id: w.id } });
    expect(after.seriesId).toBeNull();
    expect(after.seriesPosition?.toString()).toBe('1.5');
  });

  it('deleting a merge target nulls mergedIntoId on merged works', async () => {
    const target = await work();
    const merged = await work({ mergedIntoId: target.id, reviewStatus: 'MERGED' });
    await prisma.work.delete({ where: { id: target.id } });
    const after = await prisma.work.findUniqueOrThrow({ where: { id: merged.id } });
    expect(after.mergedIntoId).toBeNull();
  });

  it('deleting a user nulls createdById on their works and editions', async () => {
    const u = await user();
    const w = await work({ createdById: u.id, source: 'MANUAL' });
    const e = await edition(w.id, { createdById: u.id, source: 'MANUAL' });
    await prisma.user.delete({ where: { id: u.id } });
    expect((await prisma.work.findUniqueOrThrow({ where: { id: w.id } })).createdById).toBeNull();
    expect(
      (await prisma.edition.findUniqueOrThrow({ where: { id: e.id } })).createdById,
    ).toBeNull();
  });

  it('stores seriesPosition as a decimal', async () => {
    const w = await work({ seriesPosition: '1.5' });
    const read = await prisma.work.findUniqueOrThrow({ where: { id: w.id } });
    expect(read.seriesPosition?.toString()).toBe('1.5');
  });
});
