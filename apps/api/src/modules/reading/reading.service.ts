import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { type BookStatus, ErrorCode } from '@verso/shared';
import { ApiException } from '../../common/api-exception.js';
import type { PrismaTransaction } from '../../infra/prisma/transaction.js';
import { localToday } from './domain/local-date.js';
import { type LocalDate, type ReadingDates, ReadingLifecycle } from './domain/reading-lifecycle.js';
import { ReadingRepository } from './reading.repository.js';

export type AddForBook = {
  userBookId: string;
  status: BookStatus;
  /** The date in the user's time zone, from `today()`. */
  today: LocalDate;
  dates?: ReadingDates;
};

@Injectable()
export class ReadingService {
  constructor(@Inject(ReadingRepository) private readonly repo: ReadingRepository) {}

  today(timeZone: string, now: Date = new Date()): LocalDate {
    return localToday(timeZone, now);
  }

  /** 400 READING_DATE_IN_FUTURE when a date is after `today`. Call it before writing anything. */
  assertNotInFuture(dates: ReadingDates, today: LocalDate): void {
    // YYYY-MM-DD strings sort like dates.
    if ([dates.startedOn, dates.finishedOn].some((date) => date && date > today)) {
      throw new ApiException(HttpStatus.BAD_REQUEST, ErrorCode.READING_DATE_IN_FUTURE);
    }
  }

  /**
   * Creates the readings of a book that enters the library. The caller writes the UserBook with
   * its status in the same transaction.
   */
  async addForBook(tx: PrismaTransaction, input: AddForBook): Promise<void> {
    const changes = ReadingLifecycle.add(input.status, input.today, input.dates);
    for (const change of changes) {
      if (change.type === 'CREATE_READING') {
        await this.repo.create(tx, input.userBookId, change.reading);
      }
    }
  }

  /** Finished readings per book ("Read ×N"). Books without one have no entry. */
  async countFinished(userBookIds: string[]): Promise<Map<string, number>> {
    if (userBookIds.length === 0) return new Map();
    return this.repo.countFinished(userBookIds);
  }
}
