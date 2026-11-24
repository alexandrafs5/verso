/** The fields of an edition that hint at the original language of its work. */
export type LanguageHint = {
  /** ISO 639-1. */
  language: string | null;
  publishYear: number | null;
  /** ISO 639-1 of the language this edition was translated from, when the provider says so. */
  translatedFrom?: string | null;
};

/**
 * Open Library has no "original language" field, so it is derived (SPEC 18), in order:
 * 1. the most frequent `translatedFrom` of the list (ties go to the first seen);
 * 2. else the language of the oldest edition that has both a language and a year (ties go to
 *    the first in list order);
 * 3. else null.
 * Pure, no Nest or Prisma imports. Call it on the full list, before any language filter.
 */
export function originalLanguage(editions: readonly LanguageHint[]): string | null {
  const counts = new Map<string, number>();
  for (const edition of editions) {
    if (edition.translatedFrom) {
      counts.set(edition.translatedFrom, (counts.get(edition.translatedFrom) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [language, count] of counts) {
    if (count > bestCount) {
      best = language;
      bestCount = count;
    }
  }
  if (best !== null) return best;

  let oldest: { language: string; year: number } | null = null;
  for (const edition of editions) {
    if (!edition.language || edition.publishYear === null) continue;
    if (oldest === null || edition.publishYear < oldest.year) {
      oldest = { language: edition.language, year: edition.publishYear };
    }
  }
  return oldest?.language ?? null;
}
