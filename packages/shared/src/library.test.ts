import { describe, expect, it } from 'vitest';
import {
  addToLibraryBodySchema,
  bookStatusSchema,
  libraryStatusSchema,
  tagColorSchema,
} from './library.js';

describe('bookStatusSchema', () => {
  it.each(['READING', 'READ', 'WANT_TO_READ', 'ABANDONED'])('accepts %s', (status) => {
    expect(bookStatusSchema.parse(status)).toBe(status);
  });

  it('rejects any other string', () => {
    expect(bookStatusSchema.safeParse('PAUSED').success).toBe(false);
    expect(bookStatusSchema.safeParse('read').success).toBe(false);
  });
});

describe('tagColorSchema', () => {
  it.each(['WINE', 'TOBACCO', 'BRASS', 'FOREST', 'NAVY', 'OXBLOOD', 'SLATE', 'SAND'])(
    'accepts %s',
    (color) => {
      expect(tagColorSchema.parse(color)).toBe(color);
    },
  );

  it('rejects any other string', () => {
    expect(tagColorSchema.safeParse('PINK').success).toBe(false);
    expect(tagColorSchema.safeParse('wine').success).toBe(false);
  });
});

const UUID = '0190f0f0-1234-7abc-8def-0123456789ab';

const status = { userBookId: UUID, status: 'READ', readCount: 1, editionRef: 'ol:OL1M' };

describe('libraryStatusSchema', () => {
  it('accepts an Open Library or a local edition ref', () => {
    expect(libraryStatusSchema.parse(status)).toEqual(status);
    expect(libraryStatusSchema.safeParse({ ...status, editionRef: UUID }).success).toBe(true);
  });

  it('rejects a bad id, count or edition ref', () => {
    expect(libraryStatusSchema.safeParse({ ...status, userBookId: 'x' }).success).toBe(false);
    expect(libraryStatusSchema.safeParse({ ...status, readCount: -1 }).success).toBe(false);
    expect(libraryStatusSchema.safeParse({ ...status, editionRef: 'ol:OL1W' }).success).toBe(false);
  });
});

describe('addToLibraryBodySchema', () => {
  const body = { workRef: 'ol:OL1W', status: 'READ' };
  const parse = (extra: object) => addToLibraryBodySchema.safeParse({ ...body, ...extra });

  it('accepts a body without edition or dates', () => {
    expect(parse({}).success).toBe(true);
    expect(parse({ status: 'WANT_TO_READ' }).success).toBe(true);
  });

  it('accepts either date, both, or the same day', () => {
    expect(parse({ startedOn: '2025-01-02' }).success).toBe(true);
    expect(parse({ finishedOn: '2025-01-02' }).success).toBe(true);
    expect(parse({ startedOn: '2025-01-02', finishedOn: '2025-02-10' }).success).toBe(true);
    expect(parse({ startedOn: '2025-01-02', finishedOn: '2025-01-02' }).success).toBe(true);
    expect(parse({ finishedOn: '2024-02-29' }).success).toBe(true);
  });

  it.each(['2025-02-29', '2025-13-01', '2025-1-2', '2025-01-02T00:00:00Z', '0000-01-01', ''])(
    'rejects the date %j',
    (date) => {
      expect(parse({ finishedOn: date }).success).toBe(false);
    },
  );

  it('rejects a start after the finish', () => {
    expect(parse({ startedOn: '2025-02-10', finishedOn: '2025-01-02' }).success).toBe(false);
  });

  it.each(['WANT_TO_READ', 'READING', 'ABANDONED'])('rejects dates with status %s', (value) => {
    expect(parse({ status: value, startedOn: '2025-01-02' }).success).toBe(false);
    expect(parse({ status: value, finishedOn: '2025-01-02' }).success).toBe(false);
  });

  it('rejects a missing status or a bad ref', () => {
    expect(addToLibraryBodySchema.safeParse({ workRef: 'ol:OL1W' }).success).toBe(false);
    expect(parse({ workRef: 'OL1W' }).success).toBe(false);
    expect(parse({ editionRef: 'ol:OL1W' }).success).toBe(false);
  });
});
