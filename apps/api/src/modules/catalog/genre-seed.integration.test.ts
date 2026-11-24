import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { GENRES } from '@verso/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaModule } from '../../infra/prisma/prisma.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { seedGenres } from './genre-seed.js';

describe('seedGenres (real Postgres)', () => {
  let prisma: PrismaService;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
    prisma = ctx.get(PrismaService);
    close = () => ctx.close();
  });

  afterAll(async () => {
    await close();
  });

  it('creates the 12 genres and a second run leaves the same rows', async () => {
    const slugs = GENRES.map((g) => g.slug);
    const read = () =>
      prisma.genre.findMany({ where: { slug: { in: [...slugs] } }, orderBy: { slug: 'asc' } });

    await seedGenres(prisma);
    const first = await read();
    expect(first).toHaveLength(12);
    expect(first.every((g) => g.id === g.slug)).toBe(true);
    expect(first.find((g) => g.slug === 'mystery')?.name).toBe('Mystery');

    await seedGenres(prisma);
    expect(await read()).toEqual(first);
  });

  it('restores a changed name on the next run', async () => {
    await prisma.genre.update({ where: { slug: 'fiction' }, data: { name: 'Changed' } });
    await seedGenres(prisma);
    expect((await prisma.genre.findUniqueOrThrow({ where: { slug: 'fiction' } })).name).toBe(
      'Fiction',
    );
  });
});
