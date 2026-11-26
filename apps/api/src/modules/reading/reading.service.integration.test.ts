import 'reflect-metadata';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { BookStatus } from '@verso/shared';
import { v7 as uuidv7 } from 'uuid';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { ReadingModule } from './reading.module.js';
import { ReadingService } from './reading.service.js';

const TAG = `rs${Date.now().toString(36)}`;
const TODAY = '2026-03-01';

@Module({ imports: [PrismaModule, ReadingModule] })
class TestModule {}

describe('ReadingService (real Postgres)', () => {
  let prisma: PrismaService;
  let readings: ReadingService;
  let close: () => Promise<void>;

  const userBook = async (status: BookStatus = 'WANT_TO_READ') => {
    const user = await prisma.user.create({
      data: { id: uuidv7(), email: `${TAG}-${uuidv7()}@example.com`, name: `${TAG} user` },
    });
    const work = await prisma.work.create({ data: { id: uuidv7(), title: `${TAG} work` } });
    const edition = await prisma.edition.create({
      data: { id: uuidv7(), workId: work.id, title: `${TAG} ed` },
    });
    return prisma.userBook.create({
      data: { id: uuidv7(), userId: user.id, workId: work.id, editionId: edition.id, status },
    });
  };
  const stored = async (userBookId: string) =>
    (await prisma.reading.findMany({ where: { userBookId }, orderBy: { number: 'asc' } })).map(
      (r) => ({
        number: r.number,
        state: r.state,
        startedOn: r.startedOn?.toISOString().slice(0, 10) ?? null,
        finishedOn: r.finishedOn?.toISOString().slice(0, 10) ?? null,
        percentBp: r.percentBp,
      }),
    );
  const add = async (status: BookStatus, dates?: { startedOn?: string; finishedOn?: string }) => {
    const book = await userBook(status);
    await prisma.$transaction((tx) =>
      readings.addForBook(tx, { userBookId: book.id, status, today: TODAY, dates }),
    );
    return book.id;
  };

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(TestModule, { logger: false });
    prisma = ctx.get(PrismaService);
    readings = ctx.get(ReadingService);
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

  describe('addForBook', () => {
    it('creates no reading for Want to read', async () => {
      expect(await stored(await add('WANT_TO_READ'))).toEqual([]);
    });

    it('opens a reading that starts today for Reading', async () => {
      expect(await stored(await add('READING'))).toEqual([
        { number: 1, state: 'IN_PROGRESS', startedOn: TODAY, finishedOn: null, percentBp: 0 },
      ]);
    });

    it('stores a finished reading with its dates for Read', async () => {
      const id = await add('READ', { startedOn: '2025-01-02', finishedOn: '2025-02-10' });
      expect(await stored(id)).toEqual([
        {
          number: 1,
          state: 'FINISHED',
          startedOn: '2025-01-02',
          finishedOn: '2025-02-10',
          percentBp: 10_000,
        },
      ]);
    });

    it('leaves unknown dates null for Read', async () => {
      expect(await stored(await add('READ'))).toMatchObject([
        { state: 'FINISHED', startedOn: null, finishedOn: null },
      ]);
    });

    it('keeps a very old date', async () => {
      const id = await add('READ', { finishedOn: '0001-01-01' });
      expect(await stored(id)).toMatchObject([{ finishedOn: '0001-01-01' }]);
    });

    it('records an abandoned reading without dates for Abandoned', async () => {
      expect(await stored(await add('ABANDONED'))).toEqual([
        { number: 1, state: 'ABANDONED', startedOn: null, finishedOn: null, percentBp: 0 },
      ]);
    });

    it('rolls back with the transaction', async () => {
      const book = await userBook('READING');
      await expect(
        prisma.$transaction(async (tx) => {
          await readings.addForBook(tx, { userBookId: book.id, status: 'READING', today: TODAY });
          throw new Error('abort');
        }),
      ).rejects.toThrow('abort');
      expect(await stored(book.id)).toEqual([]);
    });
  });

  describe('countFinished', () => {
    it('counts only finished readings, per book', async () => {
      const read = await add('READ');
      await prisma.reading.createMany({
        data: [
          { id: uuidv7(), userBookId: read, number: 2, state: 'FINISHED' },
          { id: uuidv7(), userBookId: read, number: 3, state: 'ABANDONED' },
          { id: uuidv7(), userBookId: read, number: 4, state: 'IN_PROGRESS' },
        ],
      });
      const reading = await add('READING');

      const counts = await readings.countFinished([read, reading]);

      expect(counts.get(read)).toBe(2);
      expect(counts.has(reading)).toBe(false);
    });

    it('returns an empty map for no books', async () => {
      expect(await readings.countFinished([])).toEqual(new Map());
    });
  });

  describe('assertNotInFuture', () => {
    it('accepts today, the past and missing dates', () => {
      expect(() => readings.assertNotInFuture({}, TODAY)).not.toThrow();
      expect(() =>
        readings.assertNotInFuture({ startedOn: '2020-01-01', finishedOn: TODAY }, TODAY),
      ).not.toThrow();
    });

    it.each([{ startedOn: '2026-03-02' }, { finishedOn: '2027-01-01' }])('rejects %o', (dates) => {
      expect(() => readings.assertNotInFuture(dates, TODAY)).toThrowError(
        expect.objectContaining({ code: 'READING_DATE_IN_FUTURE' }),
      );
    });
  });
});
