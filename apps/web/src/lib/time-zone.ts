/**
 * The browser time zone when the API will accept it, else undefined (the account keeps its
 * current value). The API validates against Intl.supportedValuesOf, so the client does too.
 */
export function browserTimeZone(): string | undefined {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!zone) return undefined;
    return zone === 'UTC' || Intl.supportedValuesOf('timeZone').includes(zone) ? zone : undefined;
  } catch {
    return undefined;
  }
}

/** The calendar year it is right now in an IANA time zone (the account's, as the API sees it). */
export function currentYearIn(timeZone: string, now: Date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric' }).format(now));
}
