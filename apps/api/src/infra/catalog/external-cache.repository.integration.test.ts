import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ExternalCacheRepository } from './external-cache.repository.js';

const PREFIX = 'test:external-cache:';

describe('ExternalCacheRepository (real Postgres)', () => {
  let prisma: PrismaService;
  let repo: ExternalCacheRepository;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const ctx = await NestFactory.createApplicationContext(PrismaModule, { logger: false });
    prisma = ctx.get(PrismaService);
    repo = new ExternalCacheRepository(prisma);
    close = () => ctx.close();
  });

  afterEach(async () => {
    await prisma.externalCache.deleteMany({ where: { key: { startsWith: PREFIX } } });
  });

  afterAll(async () => {
    await close();
  });

  it('returns null for a missing key', async () => {
    expect(await repo.get(`${PREFIX}missing`)).toBeNull();
  });

  it('stores and reads a JSON payload', async () => {
    const payload = { title: 'Pedro Páramo', years: [1955], nested: { ok: true } };
    await repo.set(`${PREFIX}a`, payload, 60);
    expect(await repo.get(`${PREFIX}a`)).toEqual(payload);
  });

  it('set upserts by key and refreshes the expiry', async () => {
    await repo.set(`${PREFIX}b`, { v: 1 }, 60);
    await repo.set(`${PREFIX}b`, { v: 2 }, 3600);
    expect(await repo.get(`${PREFIX}b`)).toEqual({ v: 2 });
    expect(await prisma.externalCache.count({ where: { key: `${PREFIX}b` } })).toBe(1);
    const row = await prisma.externalCache.findUniqueOrThrow({ where: { key: `${PREFIX}b` } });
    const secondsLeft = (row.expiresAt.getTime() - Date.now()) / 1000;
    expect(secondsLeft).toBeGreaterThan(3500);
    expect(secondsLeft).toBeLessThanOrEqual(3600);
  });

  it('get ignores expired rows', async () => {
    await repo.set(`${PREFIX}c`, { v: 1 }, 60);
    await prisma.externalCache.update({
      where: { key: `${PREFIX}c` },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect(await repo.get(`${PREFIX}c`)).toBeNull();
  });

  it('deleteExpired removes only expired rows and returns the count', async () => {
    await repo.set(`${PREFIX}old1`, { v: 1 }, 60);
    await repo.set(`${PREFIX}old2`, { v: 2 }, 60);
    await repo.set(`${PREFIX}fresh`, { v: 3 }, 3600);
    await prisma.externalCache.updateMany({
      where: { key: { in: [`${PREFIX}old1`, `${PREFIX}old2`] } },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const removed = await repo.deleteExpired();

    expect(removed).toBeGreaterThanOrEqual(2);
    expect(await prisma.externalCache.count({ where: { key: `${PREFIX}old1` } })).toBe(0);
    expect(await prisma.externalCache.count({ where: { key: `${PREFIX}old2` } })).toBe(0);
    expect(await repo.get(`${PREFIX}fresh`)).toEqual({ v: 3 });
  });
});
