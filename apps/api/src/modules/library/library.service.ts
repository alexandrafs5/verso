import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type AddToLibraryBody, type AddToLibraryResponse, ErrorCode } from '@verso/shared';
import { v7 as uuidv7 } from 'uuid';
import { ApiException } from '../../common/api-exception.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { isUniqueViolation } from '../../infra/prisma/unique-violation.js';
import type { AuthUser } from '../auth/index.js';
import { CatalogService } from '../catalog/catalog.service.js';
import { ReadingService } from '../reading/reading.service.js';
import { LibraryRepository } from './library.repository.js';

const alreadyInLibrary = () =>
  new ApiException(HttpStatus.CONFLICT, ErrorCode.BOOK_ALREADY_IN_LIBRARY);

/** Every method acts on the session user and never takes a user id from the client. */
@Injectable()
export class LibraryService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(LibraryRepository) private readonly repo: LibraryRepository,
    @Inject(CatalogService) private readonly catalog: CatalogService,
    @Inject(ReadingService) private readonly readings: ReadingService,
  ) {}

  /**
   * Adds a book (SPEC 20). The catalog rows are saved first, in their own transaction: they are
   * shared and safe to keep. The UserBook and its readings commit or roll back together.
   */
  async add(user: AuthUser, input: AddToLibraryBody): Promise<AddToLibraryResponse> {
    const { workRef, editionRef, status, startedOn, finishedOn } = input;
    const today = this.readings.today(user.timeZone);
    this.readings.assertNotInFuture({ startedOn, finishedOn }, today);

    const target = await this.catalog.findWorkForLibrary(user.id, workRef);
    // Before saving anything, so a repeated add writes nothing.
    if (target.workId !== null && (await this.repo.hasWork(user.id, target.workId))) {
      throw alreadyInLibrary();
    }
    const saved = await this.catalog.saveForLibrary(target, { editionRef, locale: user.locale });

    const userBookId = uuidv7();
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.repo.create(tx, {
          id: userBookId,
          userId: user.id,
          workId: saved.workId,
          editionId: saved.editionId,
          status,
        });
        await this.readings.addForBook(tx, {
          userBookId,
          status,
          today,
          dates: { startedOn, finishedOn },
        });
      });
    } catch (error) {
      // A concurrent add of the same book won: (userId, workId) is unique.
      if (isUniqueViolation(error)) throw alreadyInLibrary();
      throw error;
    }

    const finished = await this.readings.countFinished([userBookId]);
    return {
      userBookId,
      workRef: saved.workId,
      status,
      readCount: finished.get(userBookId) ?? 0,
      editionRef: saved.editionRef,
    };
  }
}
