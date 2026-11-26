import { Inject, Injectable } from '@nestjs/common';
import { v7 as uuidv7 } from 'uuid';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { PrismaTransaction } from '../../infra/prisma/transaction.js';
import { isUniqueViolation } from '../../infra/prisma/unique-violation.js';
import type { Author, Edition, Prisma } from '../../generated/prisma/client.js';
import type { EditionRecord, WorkRecord } from './catalog.records.js';

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

/** A concurrent add can win each unique key once, so a few attempts are plenty. */
const SAVE_ATTEMPTS = 5;

/**
 * Prisma only. Visibility rules live in CatalogService. The only write is `saveOpenLibraryBook`,
 * which runs when a user adds a book, never on a read (CLAUDE.md hard rule).
 */
@Injectable()
export class CatalogRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findEditionByOlKey(olEditionKey: string): Promise<Edition | null> {
    return this.prisma.edition.findUnique({ where: { olEditionKey } });
  }

  /** A saved edition of the work, by local id or Open Library key. */
  findEditionOfWork(
    workId: string,
    ref: { id: string } | { olEditionKey: string },
  ): Promise<Edition | null> {
    return this.prisma.edition.findFirst({ where: { ...ref, workId } });
  }

  /**
   * Saves the work (with authors and genres) and the edition in one transaction, reusing every
   * row that already exists and never changing it. `work` may be omitted when the work is saved.
   * The returned edition can belong to another work when its key was saved elsewhere.
   */
  async saveOpenLibraryBook(
    olWorkKey: string,
    work: WorkRecord | null,
    edition: EditionRecord,
  ): Promise<{ workId: string; edition: Edition }> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const workId = await this.findOrCreateWork(tx, olWorkKey, work);
          return { workId, edition: await this.findOrCreateEdition(tx, workId, edition) };
        });
      } catch (error) {
        // Another add saved the same row first: the next attempt reads it.
        if (!isUniqueViolation(error) || attempt >= SAVE_ATTEMPTS) throw error;
      }
    }
  }

  private async findOrCreateWork(
    tx: PrismaTransaction,
    olWorkKey: string,
    work: WorkRecord | null,
  ): Promise<string> {
    const existing = await tx.work.findUnique({ where: { olWorkKey }, select: { id: true } });
    if (existing) return existing.id;
    if (!work) throw new Error(`Work ${olWorkKey} is not saved and there is no data to save it`);

    const { authors, genres, ...data } = work;
    const id = uuidv7();
    await tx.work.create({
      data: { id, ...data, source: 'OPEN_LIBRARY', catalogStatus: 'PUBLIC' },
    });
    for (const [position, author] of authors.entries()) {
      const saved =
        (await tx.author.findUnique({
          where: { olAuthorKey: author.olAuthorKey },
          select: { id: true },
        })) ?? (await tx.author.create({ data: { id: uuidv7(), ...author } }));
      await tx.workAuthor.create({ data: { workId: id, authorId: saved.id, position } });
    }
    for (const { slug, name } of genres) {
      // The seed creates these rows with the slug as the id (SPEC 18).
      const genre =
        (await tx.genre.findUnique({ where: { slug }, select: { id: true } })) ??
        (await tx.genre.create({ data: { id: slug, slug, name } }));
      await tx.workGenre.create({ data: { workId: id, genreId: genre.id } });
    }
    return id;
  }

  private async findOrCreateEdition(
    tx: PrismaTransaction,
    workId: string,
    edition: EditionRecord,
  ): Promise<Edition> {
    const existing = await tx.edition.findUnique({
      where: { olEditionKey: edition.olEditionKey },
    });
    if (existing) return existing;
    // Open Library can give two editions one ISBN-13: the later one is saved without it.
    const taken =
      edition.isbn13 !== null &&
      (await tx.edition.findUnique({ where: { isbn13: edition.isbn13 }, select: { id: true } }));
    return tx.edition.create({
      data: {
        id: uuidv7(),
        workId,
        ...edition,
        isbn13: taken ? null : edition.isbn13,
        source: 'OPEN_LIBRARY',
      },
    });
  }

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
