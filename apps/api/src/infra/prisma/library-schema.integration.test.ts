import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';

const TAG = `ls${Date.now().toString(36)}`;

// Prisma error codes.
const UNIQUE_VIOLATION = { code: 'P2002' };

describe('Library schema (real Postgres)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;

  const user = () =>
    prisma.user.create({
      data: { id: uuidv7(), email: `${TAG}-${uuidv7()}@example.com`, name: `${TAG} user` },
    });
  const book = async () => {
    const work = await prisma.work.create({ data: { id: uuidv7(), title: `${TAG} work` } });
    const edition = await prisma.edition.create({
      data: { id: uuidv7(), workId: work.id, title: `${TAG} ed` },
    });
    return { workId: work.id, editionId: edition.id };
  };
  const userBook = async (extra: Partial<Prisma.UserBookUncheckedCreateInput> = {}) =>
    prisma.userBook.create({
      data: {
        id: uuidv7(),
        userId: extra.userId ?? (await user()).id,
        status: 'WANT_TO_READ',
        ...(await book()),
        ...extra,
      },
    });
  const reading = (
    userBookId: string,
    number: number,
    extra: Partial<Prisma.ReadingUncheckedCreateInput> = {},
  ) =>
    prisma.reading.create({
      data: { id: uuidv7(), userBookId, number, state: 'FINISHED', ...extra },
    });
  const tag = (userId: string, name: string) =>
    prisma.tag.create({ data: { id: uuidv7(), userId, name, color: 'WINE' } });

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
    prisma = ctx.get(PrismaService);
    close = () => ctx.close();
  });

  // Users first: their cascade removes the library rows that block deleting works.
  afterEach(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } });
    await prisma.work.deleteMany({ where: { title: { startsWith: TAG } } });
  });

  afterAll(async () => {
    await close();
  });

  it('applies defaults', async () => {
    const entry = await userBook();
    expect(entry).toMatchObject({
      rating: null,
      hiddenFromProfile: false,
      annotationVisibility: 'INHERIT',
      progressStyle: null,
      archivedAt: null,
    });
    expect(entry.addedAt).toBeInstanceOf(Date);
    expect((await reading(entry.id, 1)).percentBp).toBe(0);
  });

  it('allows one UserBook per user and work', async () => {
    const first = await userBook();
    await expect(
      userBook({ userId: first.userId, workId: first.workId, editionId: first.editionId }),
    ).rejects.toMatchObject(UNIQUE_VIOLATION);
    await userBook({ workId: first.workId, editionId: first.editionId });
  });

  it('allows only one IN_PROGRESS reading per UserBook', async () => {
    const entry = await userBook({ status: 'READING' });
    await reading(entry.id, 1);
    await reading(entry.id, 2);
    await reading(entry.id, 3, { state: 'ABANDONED' });
    await reading(entry.id, 4, { state: 'ABANDONED' });
    await reading(entry.id, 5, { state: 'IN_PROGRESS' });
    await expect(reading(entry.id, 6, { state: 'IN_PROGRESS' })).rejects.toMatchObject(
      UNIQUE_VIOLATION,
    );

    const other = await userBook({ status: 'READING' });
    await reading(other.id, 1, { state: 'IN_PROGRESS' });
  });

  it('rejects a repeated reading number on the same UserBook', async () => {
    const entry = await userBook();
    await reading(entry.id, 1);
    await expect(reading(entry.id, 1)).rejects.toMatchObject(UNIQUE_VIOLATION);
    await reading((await userBook()).id, 1);
  });

  it('compares tag names without case, per user', async () => {
    const owner = await user();
    await tag(owner.id, 'Favorites');
    await expect(tag(owner.id, 'favorites')).rejects.toMatchObject(UNIQUE_VIOLATION);
    await tag((await user()).id, 'Favorites');
  });

  it('rejects a duplicate UserBookTag pair', async () => {
    const entry = await userBook();
    const label = await tag(entry.userId, 'Classics');
    const data = { userBookId: entry.id, tagId: label.id };
    await prisma.userBookTag.create({ data });
    await expect(prisma.userBookTag.create({ data })).rejects.toMatchObject(UNIQUE_VIOLATION);
  });

  it('keeps rating between 0 and 100', async () => {
    await userBook({ rating: 0 });
    await userBook({ rating: 100 });
    await userBook({ rating: null });
    await expect(userBook({ rating: -1 })).rejects.toThrow(/UserBook_rating_check/);
    await expect(userBook({ rating: 101 })).rejects.toThrow(/UserBook_rating_check/);
  });

  it('keeps reading progress in range', async () => {
    const entry = await userBook();
    await reading(entry.id, 1, { percentBp: 0, currentPage: 0 });
    await reading(entry.id, 2, { percentBp: 10000, currentPage: null });
    await expect(reading(entry.id, 3, { percentBp: -1 })).rejects.toThrow(
      /Reading_percentBp_check/,
    );
    await expect(reading(entry.id, 3, { percentBp: 10001 })).rejects.toThrow(
      /Reading_percentBp_check/,
    );
    await expect(reading(entry.id, 3, { currentPage: -1 })).rejects.toThrow(
      /Reading_currentPage_check/,
    );
  });

  it('restricts deleting a work or edition that a UserBook uses', async () => {
    const entry = await userBook();
    await expect(prisma.edition.delete({ where: { id: entry.editionId } })).rejects.toThrow();
    await expect(prisma.work.delete({ where: { id: entry.workId } })).rejects.toThrow();
    expect(await prisma.userBook.count({ where: { id: entry.id } })).toBe(1);
    expect(await prisma.edition.count({ where: { id: entry.editionId } })).toBe(1);
  });

  it('deleting a UserBook removes readings and tag links but keeps tags and the work', async () => {
    const entry = await userBook();
    const label = await tag(entry.userId, 'Classics');
    await reading(entry.id, 1);
    await prisma.userBookTag.create({ data: { userBookId: entry.id, tagId: label.id } });

    await prisma.userBook.delete({ where: { id: entry.id } });

    expect(await prisma.reading.count({ where: { userBookId: entry.id } })).toBe(0);
    expect(await prisma.userBookTag.count({ where: { userBookId: entry.id } })).toBe(0);
    expect(await prisma.tag.count({ where: { id: label.id } })).toBe(1);
    expect(await prisma.work.count({ where: { id: entry.workId } })).toBe(1);
  });

  it('deleting a tag removes its links and keeps the book', async () => {
    const entry = await userBook();
    const label = await tag(entry.userId, 'Classics');
    await prisma.userBookTag.create({ data: { userBookId: entry.id, tagId: label.id } });

    await prisma.tag.delete({ where: { id: label.id } });

    expect(await prisma.userBookTag.count({ where: { tagId: label.id } })).toBe(0);
    expect(await prisma.userBook.count({ where: { id: entry.id } })).toBe(1);
  });

  it('deleting a user removes their library and keeps the works', async () => {
    const entry = await userBook();
    const label = await tag(entry.userId, 'Classics');
    await reading(entry.id, 1);
    await prisma.userBookTag.create({ data: { userBookId: entry.id, tagId: label.id } });

    await prisma.user.delete({ where: { id: entry.userId } });

    expect(await prisma.userBook.count({ where: { id: entry.id } })).toBe(0);
    expect(await prisma.reading.count({ where: { userBookId: entry.id } })).toBe(0);
    expect(await prisma.tag.count({ where: { id: label.id } })).toBe(0);
    expect(await prisma.userBookTag.count({ where: { tagId: label.id } })).toBe(0);
    expect(await prisma.work.count({ where: { id: entry.workId } })).toBe(1);
  });
});
