import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Author, Edition, Prisma } from '../../generated/prisma/client.js';

const workInclude = {
  authors: { orderBy: { position: 'asc' }, include: { author: true } },
  genres: { include: { genre: true } },
  series: true,
} satisfies Prisma.WorkInclude;

const summaryInclude = {
  authors: { orderBy: { position: 'asc' }, include: { author: true } },
} satisfies Prisma.WorkInclude;

export type WorkRow = Prisma.WorkGetPayload<{ include: typeof workInclude }>;
export type WorkSummaryRow = Prisma.WorkGetPayload<{ include: typeof summaryInclude }>;
export type SeriesRow = Prisma.SeriesGetPayload<{
  include: { works: { include: typeof summaryInclude } };
}>;

const PUBLIC = { catalogStatus: 'PUBLIC' } as const;

/** Prisma reads only. Visibility rules live in CatalogService. Nothing here writes. */
@Injectable()
export class CatalogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findWorkById(id: string): Promise<WorkRow | null> {
    return this.prisma.work.findUnique({ where: { id }, include: workInclude });
  }

  findWorkByOlKey(olWorkKey: string): Promise<WorkRow | null> {
    return this.prisma.work.findUnique({ where: { olWorkKey }, include: workInclude });
  }

  /** Oldest first. `language` is an ISO 639-1 code. */
  findEditionsByWork(workId: string, language?: string): Promise<Edition[]> {
    return this.prisma.edition.findMany({
      where: { workId, ...(language ? { language } : {}) },
      orderBy: [{ publishYear: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
    });
  }

  /** The cover of the earliest saved edition that has one. */
  async findSavedCoverUrl(workId: string): Promise<string | null> {
    const edition = await this.prisma.edition.findFirst({
      where: { workId, coverUrl: { not: null } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: { coverUrl: true },
    });
    return edition?.coverUrl ?? null;
  }

  findAuthorById(id: string): Promise<Author | null> {
    return this.prisma.author.findUnique({ where: { id } });
  }

  findAuthorByOlKey(olAuthorKey: string): Promise<Author | null> {
    return this.prisma.author.findUnique({ where: { olAuthorKey } });
  }

  /** Public works of a local author, by first publication year (unknown years last). */
  findPublicWorksByAuthor(authorId: string): Promise<WorkSummaryRow[]> {
    return this.prisma.work.findMany({
      where: { ...PUBLIC, authors: { some: { authorId } } },
      orderBy: [{ firstPublishYear: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      include: summaryInclude,
    });
  }

  /** Series with its public works ordered by position (unknown positions last). */
  findSeriesById(id: string): Promise<SeriesRow | null> {
    return this.prisma.series.findUnique({
      where: { id },
      include: {
        works: {
          where: PUBLIC,
          orderBy: [{ seriesPosition: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
          include: summaryInclude,
        },
      },
    });
  }
}
