import type { BookStatus } from '@verso/shared';

/** Calendar date as `YYYY-MM-DD` in the user's time zone. */
export type LocalDate = string;

export type ReadingState = 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';

export type ReadingData = {
  number: number;
  state: ReadingState;
  startedOn: LocalDate | null;
  finishedOn: LocalDate | null;
  currentPage: number | null;
  percentBp: number;
};

export type ReadingSnapshot = ReadingData & { hasSessions: boolean };

export type LibraryState = { status: BookStatus; readings: ReadingSnapshot[] };

export type ReadingDates = { startedOn?: LocalDate | null; finishedOn?: LocalDate | null };

export type LifecycleChange =
  | { type: 'SET_STATUS'; status: BookStatus }
  | { type: 'CREATE_READING'; reading: ReadingData }
  | { type: 'UPDATE_READING'; number: number; patch: Partial<Omit<ReadingData, 'number'>> }
  | { type: 'DELETE_READING'; number: number };

export type ReadingLifecycleErrorCode = 'INVALID_TRANSITION' | 'INCONSISTENT_STATE';

export class ReadingLifecycleError extends Error {
  readonly code: ReadingLifecycleErrorCode;

  constructor(code: ReadingLifecycleErrorCode, message: string) {
    super(message);
    this.name = 'ReadingLifecycleError';
    this.code = code;
  }
}

const COMPLETE_BP = 10_000;

/**
 * State machine for a library book's status and readings (ARCHITECTURE §6.1).
 * Every method returns the changes to persist, in order. It never mutates its input and never
 * reads the clock: the caller passes `today`. Pure: no Nest or Prisma imports.
 */
export class ReadingLifecycle {
  /** Changes for a book that enters the library. `dates` only apply to a Read book. */
  static add(status: BookStatus, today: LocalDate, dates: ReadingDates = {}): LifecycleChange[] {
    const changes: LifecycleChange[] = [setStatus(status)];
    switch (status) {
      case 'WANT_TO_READ':
        return changes;
      case 'READING':
        return [...changes, createReading([], { state: 'IN_PROGRESS', startedOn: today })];
      case 'READ':
        return [
          ...changes,
          createReading([], {
            state: 'FINISHED',
            startedOn: dates.startedOn ?? null,
            finishedOn: dates.finishedOn ?? null,
            percentBp: COMPLETE_BP,
          }),
        ];
      case 'ABANDONED':
        return [...changes, createReading([], { state: 'ABANDONED' })];
    }
  }

  static start(state: LibraryState, today: LocalDate): LifecycleChange[] {
    ReadingLifecycle.check(state, 'WANT_TO_READ');
    return openNewReading(state, today);
  }

  static finish(state: LibraryState, today: LocalDate): LifecycleChange[] {
    ReadingLifecycle.check(state, 'READING');
    return [
      setStatus('READ'),
      {
        type: 'UPDATE_READING',
        number: openReading(state).number,
        patch: { state: 'FINISHED', finishedOn: today, percentBp: COMPLETE_BP },
      },
    ];
  }

  static abandon(state: LibraryState): LifecycleChange[] {
    ReadingLifecycle.check(state, 'READING');
    return [
      setStatus('ABANDONED'),
      {
        type: 'UPDATE_READING',
        number: openReading(state).number,
        patch: { state: 'ABANDONED' },
      },
    ];
  }

  /** Continues the latest abandoned reading from its saved progress. */
  static resume(state: LibraryState): LifecycleChange[] {
    ReadingLifecycle.check(state, 'ABANDONED');
    return [
      setStatus('READING'),
      {
        type: 'UPDATE_READING',
        number: highestNumber(state.readings),
        patch: { state: 'IN_PROGRESS' },
      },
    ];
  }

  /** Starts from zero; the abandoned reading stays in the history. */
  static startOver(state: LibraryState, today: LocalDate): LifecycleChange[] {
    ReadingLifecycle.check(state, 'ABANDONED');
    return openNewReading(state, today);
  }

  static reread(state: LibraryState, today: LocalDate): LifecycleChange[] {
    ReadingLifecycle.check(state, 'READ');
    return openNewReading(state, today);
  }

  /** A free status change, as in the status dropdown. The current status changes nothing. */
  static changeStatus(
    state: LibraryState,
    target: BookStatus,
    today: LocalDate,
  ): LifecycleChange[] {
    assertConsistent(state);
    if (target === state.status) return [];
    switch (target) {
      case 'READING':
        if (state.status === 'ABANDONED') return ReadingLifecycle.resume(state);
        if (state.status === 'READ') return ReadingLifecycle.reread(state, today);
        return ReadingLifecycle.start(state, today);
      case 'READ':
        return state.status === 'READING' ? ReadingLifecycle.finish(state, today) : markRead(state);
      case 'ABANDONED':
        return state.status === 'READING' ? ReadingLifecycle.abandon(state) : markAbandoned(state);
      case 'WANT_TO_READ':
        return markWantToRead(state);
    }
  }

  /** Rejects a broken input state first, then a named action called from the wrong status. */
  private static check(state: LibraryState, from: BookStatus): void {
    assertConsistent(state);
    if (state.status !== from) {
      throw new ReadingLifecycleError(
        'INVALID_TRANSITION',
        `This action needs status ${from}, got ${state.status}`,
      );
    }
  }
}

function setStatus(status: BookStatus): LifecycleChange {
  return { type: 'SET_STATUS', status };
}

/** A new reading takes the highest existing number plus one and starts with no progress. */
function createReading(
  readings: ReadingSnapshot[],
  data: Pick<ReadingData, 'state'> & Partial<ReadingData>,
): LifecycleChange {
  return {
    type: 'CREATE_READING',
    reading: {
      startedOn: null,
      finishedOn: null,
      currentPage: null,
      percentBp: 0,
      ...data,
      number: highestNumber(readings) + 1,
    },
  };
}

function openNewReading(state: LibraryState, today: LocalDate): LifecycleChange[] {
  return [
    setStatus('READING'),
    createReading(state.readings, { state: 'IN_PROGRESS', startedOn: today }),
  ];
}

/**
 * Read without an open reading: the finish date is unknown, and toggling a Read book through
 * statuses other than Reading must not add reads. Going through Reading is a reread.
 */
function markRead({ status, readings }: LibraryState): LifecycleChange[] {
  const changes = [setStatus('READ')];
  const latest = latestReading(readings);
  const abandoned = latest?.state === 'ABANDONED' ? latest : undefined;
  const hasFinished = readings.some((reading) => reading.state === 'FINISHED');

  if (abandoned && hasFinished && isEmpty(abandoned)) {
    return [...changes, { type: 'DELETE_READING', number: abandoned.number }];
  }
  if (status === 'WANT_TO_READ' && hasFinished) return changes;
  if (abandoned) {
    return [
      ...changes,
      {
        type: 'UPDATE_READING',
        number: abandoned.number,
        patch: { state: 'FINISHED', percentBp: COMPLETE_BP },
      },
    ];
  }
  return [...changes, createReading(readings, { state: 'FINISHED', percentBp: COMPLETE_BP })];
}

/**
 * Abandoned without an open reading: reuses the latest abandoned reading or records an empty one.
 * On a book already read, only an empty one is reused: reusing a reading with data would let the
 * way back to Read turn it into one more read.
 */
function markAbandoned({ readings }: LibraryState): LifecycleChange[] {
  const changes = [setStatus('ABANDONED')];
  const latest = latestReading(readings);
  const hasFinished = readings.some((reading) => reading.state === 'FINISHED');
  if (latest?.state === 'ABANDONED' && (isEmpty(latest) || !hasFinished)) return changes;
  return [...changes, createReading(readings, { state: 'ABANDONED' })];
}

/** An open reading is discarded, unless it has sessions or progress to keep. Closed ones stay. */
function markWantToRead(state: LibraryState): LifecycleChange[] {
  const changes = [setStatus('WANT_TO_READ')];
  if (state.status !== 'READING') return changes;
  const reading = openReading(state);
  const { number } = reading;
  return [
    ...changes,
    reading.hasSessions || hasProgress(reading)
      ? { type: 'UPDATE_READING', number, patch: { state: 'ABANDONED' } }
      : { type: 'DELETE_READING', number },
  ];
}

function hasProgress({ currentPage, percentBp }: ReadingSnapshot): boolean {
  return (currentPage ?? 0) > 0 || percentBp > 0;
}

/** No dates, no progress and no sessions: deleting it loses nothing. */
function isEmpty(reading: ReadingSnapshot): boolean {
  return (
    reading.startedOn === null &&
    reading.finishedOn === null &&
    !hasProgress(reading) &&
    !reading.hasSessions
  );
}

/** 0 when there are no readings. */
function highestNumber(readings: ReadingSnapshot[]): number {
  return readings.reduce((highest, reading) => Math.max(highest, reading.number), 0);
}

function latestReading(readings: ReadingSnapshot[]): ReadingSnapshot | undefined {
  const highest = highestNumber(readings);
  return readings.find((reading) => reading.number === highest);
}

function openReading(state: LibraryState): ReadingSnapshot {
  const reading = state.readings.find((candidate) => candidate.state === 'IN_PROGRESS');
  if (!reading) throw inconsistent('There is no reading in progress');
  return reading;
}

function assertConsistent({ status, readings }: LibraryState): void {
  const openCount = readings.filter((reading) => reading.state === 'IN_PROGRESS').length;
  if (status === 'READING' && openCount !== 1) {
    throw inconsistent('A READING book needs exactly one reading in progress');
  }
  if (status !== 'READING' && openCount !== 0) {
    throw inconsistent(`A ${status} book cannot have a reading in progress`);
  }
  if (status === 'ABANDONED' && latestReading(readings)?.state !== 'ABANDONED') {
    throw inconsistent('An ABANDONED book needs its latest reading abandoned');
  }
  if (status === 'READ' && !readings.some((reading) => reading.state === 'FINISHED')) {
    throw inconsistent('A READ book needs a finished reading');
  }
}

function inconsistent(message: string): ReadingLifecycleError {
  return new ReadingLifecycleError('INCONSISTENT_STATE', message);
}
