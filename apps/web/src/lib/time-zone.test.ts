import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserTimeZone, currentYearIn } from './time-zone';

function stubZone(timeZone: string) {
  vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
    () => ({ resolvedOptions: () => ({ timeZone }) }) as unknown as Intl.DateTimeFormat,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('browserTimeZone', () => {
  it('returns a supported zone', () => {
    stubZone('Europe/Madrid');
    expect(browserTimeZone()).toBe('Europe/Madrid');
  });

  it('returns UTC even though engines omit it from the supported list', () => {
    stubZone('UTC');
    expect(browserTimeZone()).toBe('UTC');
  });

  it('returns undefined for a zone the API would reject', () => {
    stubZone('Mars/Olympus');
    expect(browserTimeZone()).toBeUndefined();
  });
});

describe('currentYearIn', () => {
  // 2026-12-31 23:30 UTC is already 2027 in Madrid and still 2026 in Los Angeles.
  const newYearsEve = new Date('2026-12-31T23:30:00Z');

  it('reads the year in the given zone', () => {
    expect(currentYearIn('UTC', newYearsEve)).toBe(2026);
    expect(currentYearIn('Europe/Madrid', newYearsEve)).toBe(2027);
    expect(currentYearIn('America/Los_Angeles', newYearsEve)).toBe(2026);
  });
});
