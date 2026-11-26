import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { PrismaTransaction } from '../../infra/prisma/transaction.js';
import type { LocalDate, ReadingData } from './domain/reading-lifecycle.js';

/** `@db.Date` columns take a Date at UTC midnight. */
const toDate = (date: LocalDate | null): Date | null =>
  date === null ? null : new Date(`${date}T00:00:00.000Z`);

/** Prisma only. */
@Injectable()
export class ReadingRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async create(tx: PrismaTransaction, userBookId: string, reading: ReadingData): Promise<void> {
    await tx.reading.create({
      data: {
        id: uuidv7(),
        userBookId,
        number: reading.number,
        state: reading.state,
        startedOn: toDate(reading.startedOn),
        finishedOn: toDate(reading.finishedOn),
        currentPage: reading.currentPage,
        percentBp: reading.percentBp,
      },
    });
  }

  /** Books without a FINISHED reading have no entry. */
  async countFinished(userBookIds: string[]): Promise<Map<string, number>> {
    const groups = await this.prisma.reading.groupBy({
      by: ['userBookId'],
      where: { userBookId: { in: userBookIds }, state: 'FINISHED' },
      _count: { _all: true },
    });
    return new Map(groups.map((group) => [group.userBookId, group._count._all]));
  }
}
