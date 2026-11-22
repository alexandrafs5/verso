import { describe, expect, it } from 'vitest';
import { GoalPolicy } from './goal-policy.js';

// 2026-12-31 23:30 UTC: already 2027 in Madrid, still 2026 in Los Angeles.
const NEW_YEAR_EVE = new Date('2026-12-31T23:30:00Z');

describe('GoalPolicy', () => {
  it('reads the current year in the given time zone', () => {
    expect(GoalPolicy.currentYear('UTC', NEW_YEAR_EVE)).toBe(2026);
    expect(GoalPolicy.currentYear('Europe/Madrid', NEW_YEAR_EVE)).toBe(2027);
    expect(GoalPolicy.currentYear('America/Los_Angeles', NEW_YEAR_EVE)).toBe(2026);
  });

  it('allows the current year and the next, nothing else', () => {
    const now = new Date('2026-06-15T12:00:00Z');
    expect(GoalPolicy.allowedYears('UTC', now)).toEqual([2026, 2027]);
    expect(GoalPolicy.isYearAllowed(2026, 'UTC', now)).toBe(true);
    expect(GoalPolicy.isYearAllowed(2027, 'UTC', now)).toBe(true);
    expect(GoalPolicy.isYearAllowed(2025, 'UTC', now)).toBe(false);
    expect(GoalPolicy.isYearAllowed(2028, 'UTC', now)).toBe(false);
  });

  it('shifts the allowed window with the user time zone', () => {
    expect(GoalPolicy.isYearAllowed(2028, 'Europe/Madrid', NEW_YEAR_EVE)).toBe(true);
    expect(GoalPolicy.isYearAllowed(2028, 'America/Los_Angeles', NEW_YEAR_EVE)).toBe(false);
    expect(GoalPolicy.isYearAllowed(2026, 'Europe/Madrid', NEW_YEAR_EVE)).toBe(false);
  });
});
