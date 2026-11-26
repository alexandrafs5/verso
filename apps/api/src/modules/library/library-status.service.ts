import { Inject, Injectable } from '@nestjs/common';
import { ReadingService } from '../reading/reading.service.js';
import { LibraryMatches } from './domain/library-matches.js';
import { LibraryStatusRepository, type WorkLookup } from './library-status.repository.js';

/** What the viewer's library says about a set of works. Catalog responses use it. */
@Injectable()
export class LibraryStatusService {
  constructor(
    @Inject(LibraryStatusRepository) private readonly repo: LibraryStatusRepository,
    @Inject(ReadingService) private readonly readings: ReadingService,
  ) {}

  /** At most one query for the books and one for the read counts, whatever the number of works. */
  async find(userId: string, lookup: WorkLookup): Promise<LibraryMatches> {
    if (!lookup.workIds?.length && !lookup.olWorkKeys?.length) return new LibraryMatches([]);
    const rows = await this.repo.findActive(userId, lookup);
    const finished = await this.readings.countFinished(rows.map((row) => row.id));
    return new LibraryMatches(
      rows.map((row) => ({
        workId: row.workId,
        olWorkKey: row.work.olWorkKey,
        addedAt: row.addedAt,
        libraryStatus: {
          userBookId: row.id,
          status: row.status,
          readCount: finished.get(row.id) ?? 0,
          editionRef: row.edition.olEditionKey ? `ol:${row.edition.olEditionKey}` : row.edition.id,
        },
      })),
    );
  }
}
