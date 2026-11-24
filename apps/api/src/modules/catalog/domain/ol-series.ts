/**
 * Open Library has no series field, but its work subjects carry `series:<name>` tags
 * (for example `series:A Song of Ice and Fire`). SPEC 18 derives series from them.
 * Pure, no Nest or Prisma imports.
 */

export const OL_SERIES_PREFIX = 'ol:';
const SERIES_SUBJECT = /^series:\s*(.+)$/i;
const MAX_SERIES_NAME = 120;

export type DerivedSeries = { id: string; name: string; position: null };

export const isSeriesSubject = (subject: string): boolean => SERIES_SUBJECT.test(subject.trim());

/** "series:harry_potter" becomes "Harry Potter". A name with capitals is kept as written. */
export function seriesNameFromSubject(subject: string): string | null {
  const raw = SERIES_SUBJECT.exec(subject.trim())?.[1];
  if (raw === undefined) return null;
  const name = raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (name === '' || name.length > MAX_SERIES_NAME) return null;
  return name === name.toLowerCase()
    ? name.replace(/(^|\s)(\S)/gu, (_m, a, b) => a + b.toUpperCase())
    : name;
}

/** The first `series:` subject that gives a usable name, or null. Position is never known. */
export function seriesFromSubjects(subjects: readonly string[]): DerivedSeries | null {
  for (const subject of subjects) {
    const name = seriesNameFromSubject(subject);
    if (name !== null) return { id: `${OL_SERIES_PREFIX}${name}`, name, position: null };
  }
  return null;
}

/** The name inside an `ol:<name>` series id, or null when the id is not one. */
export function olSeriesName(id: string): string | null {
  if (!id.startsWith(OL_SERIES_PREFIX)) return null;
  const name = id.slice(OL_SERIES_PREFIX.length).trim();
  // eslint-disable-next-line no-control-regex
  if (name === '' || name.length > MAX_SERIES_NAME || /[\u0000-\u001f\u007f]/.test(name))
    return null;
  return name;
}

/** Provider search query for the works of a series. `"` is stripped from the name. */
export const seriesSearchQuery = (name: string): string =>
  `subject:"series:${name.replace(/"/g, '').trim()}"`;
