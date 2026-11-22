/** Yearly goal rules. Pure: no Nest or Prisma imports. */
export class GoalPolicy {
  /** The calendar year it is right now in the given IANA time zone. */
  static currentYear(timeZone: string, now: Date = new Date()): number {
    const year = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(now);
    return Number(year);
  }

  /** A goal can target the current year or the next one, in the user's time zone. */
  static allowedYears(timeZone: string, now: Date = new Date()): [number, number] {
    const current = GoalPolicy.currentYear(timeZone, now);
    return [current, current + 1];
  }

  static isYearAllowed(year: number, timeZone: string, now: Date = new Date()): boolean {
    return GoalPolicy.allowedYears(timeZone, now).includes(year);
  }
}
