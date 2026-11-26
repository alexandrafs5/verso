import type { LibraryStatus } from '@verso/shared';

/** One book of the viewer's library, as catalog responses need it. */
export type LibraryEntry = {
  workId: string;
  olWorkKey: string | null;
  addedAt: Date;
  libraryStatus: LibraryStatus;
};

export type LibraryMatch = Pick<LibraryEntry, 'workId' | 'libraryStatus'>;

/** Looks up the viewer's books for catalog rows (SPEC 20). Pure: no Nest or Prisma imports. */
export class LibraryMatches {
  private readonly byWorkId: Map<string, LibraryEntry>;
  private readonly byOlKey: Map<string, LibraryEntry>;

  constructor(entries: readonly LibraryEntry[]) {
    this.byWorkId = new Map(entries.map((entry) => [entry.workId, entry]));
    this.byOlKey = new Map(
      entries.flatMap((entry) => (entry.olWorkKey ? [[entry.olWorkKey, entry] as const] : [])),
    );
  }

  forWork(workId: string): LibraryEntry['libraryStatus'] | null {
    return this.byWorkId.get(workId)?.libraryStatus ?? null;
  }

  /**
   * The book for a row that merges several Open Library works. The shown work wins; else the most
   * recently added of the merged ones. Null when the viewer has none of them.
   */
  forMergedRow(shownKey: string, mergedKeys: readonly string[]): LibraryMatch | null {
    const entry =
      this.byOlKey.get(shownKey) ??
      mergedKeys
        .flatMap((key) => this.byOlKey.get(key) ?? [])
        .sort((a, b) => b.addedAt.getTime() - a.addedAt.getTime())[0];
    return entry ? { workId: entry.workId, libraryStatus: entry.libraryStatus } : null;
  }
}
