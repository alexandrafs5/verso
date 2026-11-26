import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';

const statusSelect = {
  id: true,
  workId: true,
  status: true,
  addedAt: true,
  work: { select: { olWorkKey: true } },
  edition: { select: { id: true, olEditionKey: true } },
} satisfies Prisma.UserBookSelect;

export type LibraryStatusRow = Prisma.UserBookGetPayload<{ select: typeof statusSelect }>;

export type WorkLookup = { workIds?: string[]; olWorkKeys?: string[] };

/** Prisma reads only. */
@Injectable()
export class LibraryStatusRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  /** The user's books, without archived ones, for any of the works. */
  findActive(userId: string, { workIds, olWorkKeys }: WorkLookup): Promise<LibraryStatusRow[]> {
    const any: Prisma.UserBookWhereInput[] = [];
    if (workIds?.length) any.push({ workId: { in: workIds } });
    if (olWorkKeys?.length) any.push({ work: { olWorkKey: { in: olWorkKeys } } });
    return this.prisma.userBook.findMany({
      where: { userId, archivedAt: null, OR: any },
      select: statusSelect,
    });
  }
}
