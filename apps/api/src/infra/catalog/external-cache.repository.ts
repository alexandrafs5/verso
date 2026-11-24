import { Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import type { Prisma } from '../../generated/prisma/client.js';
import type { PrismaService } from '../prisma/prisma.service.js';
import type { ExternalCacheStore } from './external-cache.js';

@Injectable()
export class ExternalCacheRepository implements ExternalCacheStore {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<unknown | null> {
    const row = await this.prisma.externalCache.findFirst({
      where: { key, expiresAt: { gt: new Date() } },
      select: { payload: true },
    });
    return row ? row.payload : null;
  }

  async set(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const json = payload as Prisma.InputJsonValue;
    await this.prisma.externalCache.upsert({
      where: { key },
      create: { id: uuidv7(), key, payload: json, expiresAt },
      update: { payload: json, expiresAt },
    });
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.externalCache.deleteMany({
      where: { expiresAt: { lte: new Date() } },
    });
    return result.count;
  }
}
