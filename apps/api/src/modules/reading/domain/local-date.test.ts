import { describe, expect, it } from 'vitest';
import { localToday } from './local-date.js';

describe('localToday', () => {
  // 03:00 UTC on 1 March: still February west of Greenwich, already 1 March to the east.
  const now = new Date('2026-03-01T03:00:00Z');

  it.each([
    ['UTC', '2026-03-01'],
    ['America/Hermosillo', '2026-02-28'],
    ['Asia/Tokyo', '2026-03-01'],
  ])('gives the date in %s', (timeZone, expected) => {
    expect(localToday(timeZone, now)).toBe(expected);
  });

  it('crosses the year east of Greenwich', () => {
    expect(localToday('Pacific/Kiritimati', new Date('2026-12-31T20:00:00Z'))).toBe('2027-01-01');
  });

  it('pads the month and the day', () => {
    expect(localToday('UTC', new Date('2026-01-05T12:00:00Z'))).toBe('2026-01-05');
  });
});
