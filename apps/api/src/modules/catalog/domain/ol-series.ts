/**
 * Open Library has no series field, but its work subjects carry `series:<name>` tags
 * (for example `series:A Song of Ice and Fire`). SPEC 18 derives series from them.
 * Pure, no Nest or Prisma imports.
 */

export const OL_SERIES_PREFIX = 'ol:';
const SERIES_SUBJECT = /^series:\s*(.+)$/i;
const MAX_SERIES_NAME = 120;

export type DerivedSeries = { id: string; name: string; position: null };

const hasControlCharacter = (text: string): boolean =>
  [...text].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127);

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
  if (name === '' || name.length > MAX_SERIES_NAME || hasControlCharacter(name)) return null;
  return name;
}

/** Provider search query on the `series` field. `"` is stripped from the name. */
export const seriesFieldQuery = (name: string): string =>
  `series:"${name.replace(/"/g, '').trim()}"`;

/** Provider search query for books whose title holds the series name, by one author. */
export const seriesTitleQuery = (name: string, authorName: string): string =>
  `title:"${name.replace(/"/g, '').trim()}" author:"${authorName.replace(/"/g, '').trim()}"`;

/** Provider search query for the works tagged with a series subject. `"` is stripped. */
export const seriesSearchQuery = (name: string): string =>
  `subject:"series:${name.replace(/"/g, '').trim()}"`;
