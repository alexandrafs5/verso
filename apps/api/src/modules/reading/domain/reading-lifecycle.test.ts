import { BOOK_STATUSES, type BookStatus } from '@verso/shared';
import { describe, expect, it } from 'vitest';
import {
  type LibraryState,
  ReadingLifecycle,
  ReadingLifecycleError,
  type ReadingSnapshot,
} from './reading-lifecycle.js';

const TODAY = '2026-03-15';

const snapshot = (number: number, extra: Partial<ReadingSnapshot> = {}): ReadingSnapshot => ({
  number,
  state: 'FINISHED',
  startedOn: null,
  finishedOn: null,
  currentPage: null,
  percentBp: 0,
  hasSessions: false,
  ...extra,
});

const open = (number: number, extra: Partial<ReadingSnapshot> = {}) =>
  snapshot(number, { state: 'IN_PROGRESS', startedOn: '2026-03-01', ...extra });
const finished = (number: number, extra: Partial<ReadingSnapshot> = {}) =>
  snapshot(number, { state: 'FINISHED', percentBp: 10000, ...extra });
const abandoned = (number: number, extra: Partial<ReadingSnapshot> = {}) =>
  snapshot(number, { state: 'ABANDONED', ...extra });

const library = (status: BookStatus, ...readings: ReadingSnapshot[]): LibraryState => ({
  status,
  readings,
});

/** One consistent state per status. */
const SAMPLES: Record<BookStatus, LibraryState> = {
  WANT_TO_READ: library('WANT_TO_READ'),
  READING: library('READING', open(1)),
  READ: library('READ', finished(1)),
  ABANDONED: library('ABANDONED', abandoned(1, { percentBp: 4000 })),
};

const newReading = (number: number) => ({
  type: 'CREATE_READING',
  reading: {
    number,
    state: 'IN_PROGRESS',
    startedOn: TODAY,
    finishedOn: null,
    currentPage: null,
    percentBp: 0,
  },
});

const setStatus = (status: BookStatus) => ({ type: 'SET_STATUS', status });

const errorCode = (run: () => unknown) => {
  try {
    run();
  } catch (error) {
    if (error instanceof ReadingLifecycleError) return error.code;
    throw error;
  }
  return null;
};

describe('ReadingLifecycle.add', () => {
  it('adds a Want to read book without readings', () => {
    expect(ReadingLifecycle.add('WANT_TO_READ', TODAY)).toEqual([setStatus('WANT_TO_READ')]);
  });

  it('opens reading 1 today for a Reading book', () => {
    expect(ReadingLifecycle.add('READING', TODAY)).toEqual([setStatus('READING'), newReading(1)]);
  });

  it('records a finished reading with unknown dates for a Read book', () => {
    expect(ReadingLifecycle.add('READ', TODAY)).toEqual([
      setStatus('READ'),
      {
        type: 'CREATE_READING',
        reading: {
          number: 1,
          state: 'FINISHED',
          startedOn: null,
          finishedOn: null,
          currentPage: null,
          percentBp: 10000,
        },
      },
    ]);
  });

  it('keeps the given dates for a Read book', () => {
    const dates = { startedOn: '2025-01-02', finishedOn: '2025-02-10' };
    expect(ReadingLifecycle.add('READ', TODAY, dates)[1]).toMatchObject({ reading: dates });
  });

  it('records an abandoned reading without dates for an Abandoned book', () => {
    expect(ReadingLifecycle.add('ABANDONED', TODAY)).toEqual([
      setStatus('ABANDONED'),
      {
        type: 'CREATE_READING',
        reading: {
          number: 1,
          state: 'ABANDONED',
          startedOn: null,
          finishedOn: null,
          currentPage: null,
          percentBp: 0,
        },
      },
    ]);
  });

  it.each(['WANT_TO_READ', 'READING', 'ABANDONED'] as const)(
    'ignores the dates when adding as %s',
    (status) => {
      const dates = { startedOn: '2025-01-02', finishedOn: '2025-02-10' };
      expect(ReadingLifecycle.add(status, TODAY, dates)).toEqual(
        ReadingLifecycle.add(status, TODAY),
      );
    },
  );
});

describe('ReadingLifecycle named actions', () => {
  it('start opens a new reading', () => {
    expect(ReadingLifecycle.start(SAMPLES.WANT_TO_READ, TODAY)).toEqual([
      setStatus('READING'),
      newReading(1),
    ]);
  });

  it('finish closes the open reading today at 100% and leaves the page', () => {
    const state = library('READING', finished(1), open(2, { currentPage: 120, percentBp: 4000 }));
    expect(ReadingLifecycle.finish(state, TODAY)).toEqual([
      setStatus('READ'),
      {
        type: 'UPDATE_READING',
        number: 2,
        patch: { state: 'FINISHED', finishedOn: TODAY, percentBp: 10000 },
      },
    ]);
  });

  it('abandon closes the open reading and keeps progress and start date', () => {
    expect(ReadingLifecycle.abandon(SAMPLES.READING)).toEqual([
      setStatus('ABANDONED'),
      { type: 'UPDATE_READING', number: 1, patch: { state: 'ABANDONED' } },
    ]);
  });

  it('resume reopens the latest reading, whatever the input order', () => {
    const state = library('ABANDONED', abandoned(3), finished(1), abandoned(2));
    expect(ReadingLifecycle.resume(state)).toEqual([
      setStatus('READING'),
      { type: 'UPDATE_READING', number: 3, patch: { state: 'IN_PROGRESS' } },
    ]);
  });

  it('startOver opens a new reading and leaves the abandoned one', () => {
    expect(ReadingLifecycle.startOver(SAMPLES.ABANDONED, TODAY)).toEqual([
      setStatus('READING'),
      newReading(2),
    ]);
  });

  it('reread opens a new reading', () => {
    expect(ReadingLifecycle.reread(SAMPLES.READ, TODAY)).toEqual([
      setStatus('READING'),
      newReading(2),
    ]);
  });

  it('numbers a new reading after the highest one', () => {
    const state = library('READ', finished(5), finished(2));
    expect(ReadingLifecycle.reread(state, TODAY)[1]).toEqual(newReading(6));
  });

  const actions: [string, BookStatus, (state: LibraryState) => unknown][] = [
    ['start', 'WANT_TO_READ', (s) => ReadingLifecycle.start(s, TODAY)],
    ['finish', 'READING', (s) => ReadingLifecycle.finish(s, TODAY)],
    ['abandon', 'READING', (s) => ReadingLifecycle.abandon(s)],
    ['resume', 'ABANDONED', (s) => ReadingLifecycle.resume(s)],
    ['startOver', 'ABANDONED', (s) => ReadingLifecycle.startOver(s, TODAY)],
    ['reread', 'READ', (s) => ReadingLifecycle.reread(s, TODAY)],
  ];

  const wrongSources = actions.flatMap(([name, from, run]) =>
    BOOK_STATUSES.filter((status) => status !== from).map((status) => [name, status, run] as const),
  );

  it.each(wrongSources)('%s rejects a %s book', (_name, status, run) => {
    expect(errorCode(() => run(SAMPLES[status]))).toBe('INVALID_TRANSITION');
  });

  it('never mutates the input', () => {
    for (const [, from, run] of actions) {
      const state = structuredClone(SAMPLES[from]);
      run(state);
      expect(state).toEqual(SAMPLES[from]);
    }
  });
});

describe('ReadingLifecycle consistency', () => {
  const broken: [string, LibraryState][] = [
    ['a Reading book without an open reading', library('READING', finished(1))],
    ['a Reading book with two open readings', library('READING', open(1), open(2))],
    ['a Want to read book with an open reading', library('WANT_TO_READ', open(1))],
    ['a Read book with an open reading', library('READ', finished(1), open(2))],
    ['an Abandoned book with an open reading', library('ABANDONED', open(1), abandoned(2))],
    ['an Abandoned book without readings', library('ABANDONED')],
    [
      'an Abandoned book whose latest reading is finished',
      library('ABANDONED', abandoned(1), finished(2)),
    ],
    ['a Read book without a finished reading', library('READ', abandoned(1))],
  ];

  const methods: [string, (state: LibraryState) => unknown][] = [
    ['start', (s) => ReadingLifecycle.start(s, TODAY)],
    ['finish', (s) => ReadingLifecycle.finish(s, TODAY)],
    ['abandon', (s) => ReadingLifecycle.abandon(s)],
    ['resume', (s) => ReadingLifecycle.resume(s)],
    ['startOver', (s) => ReadingLifecycle.startOver(s, TODAY)],
    ['reread', (s) => ReadingLifecycle.reread(s, TODAY)],
  ];

  describe.each(broken)('%s', (_label, state) => {
    it.each(methods)('makes %s throw INCONSISTENT_STATE', (_name, run) => {
      expect(errorCode(() => run(state))).toBe('INCONSISTENT_STATE');
    });
  });
});
