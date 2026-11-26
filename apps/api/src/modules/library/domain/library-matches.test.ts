import { describe, expect, it } from 'vitest';
import { type LibraryEntry, LibraryMatches } from './library-matches.js';

const entry = (workId: string, olWorkKey: string | null, day: number): LibraryEntry => ({
  workId,
  olWorkKey,
  addedAt: new Date(Date.UTC(2026, 0, day)),
  libraryStatus: {
    userBookId: `book-${workId}`,
    status: 'READ',
    readCount: 1,
    editionRef: 'ol:OL1M',
  },
});

describe('LibraryMatches', () => {
  const matches = new LibraryMatches([
    entry('w1', 'OL1W', 1),
    entry('w2', 'OL2W', 3),
    entry('w3', 'OL3W', 2),
    entry('manual', null, 4),
  ]);

  it('finds a book by work id', () => {
    expect(matches.forWork('manual')?.userBookId).toBe('book-manual');
    expect(matches.forWork('other')).toBeNull();
  });

  it('prefers the shown work over a newer merged one', () => {
    expect(matches.forMergedRow('OL1W', ['OL1W', 'OL2W'])?.workId).toBe('w1');
  });

  it('else takes the most recently added merged work', () => {
    expect(matches.forMergedRow('OL9W', ['OL9W', 'OL3W', 'OL2W'])?.workId).toBe('w2');
  });

  it('returns null when the viewer has none of the works', () => {
    expect(matches.forMergedRow('OL9W', ['OL9W', 'OL8W'])).toBeNull();
    expect(new LibraryMatches([]).forMergedRow('OL1W', ['OL1W'])).toBeNull();
  });
});
