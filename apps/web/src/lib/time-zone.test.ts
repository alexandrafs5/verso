import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserTimeZone } from './time-zone';

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
