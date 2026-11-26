import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { PrismaTransaction } from '../../infra/prisma/transaction.js';
import type { Prisma } from '../../generated/prisma/client.js';

export type NewUserBook = Pick<
  Prisma.UserBookUncheckedCreateInput,
  'id' | 'userId' | 'workId' | 'editionId' | 'status'
>;

/** Prisma only. Every query is scoped to one user. */
@Injectable()
export class LibraryRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** True when the user has the work, archived or not. */
  async hasWork(userId: string, workId: string): Promise<boolean> {
    const book = await this.prisma.userBook.findUnique({
      where: { userId_workId: { userId, workId } },
      select: { id: true },
    });
    return book !== null;
  }

  async create(tx: PrismaTransaction, data: NewUserBook): Promise<void> {
    await tx.userBook.create({ data });
  }
}
