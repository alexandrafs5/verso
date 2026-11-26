/**
 * Default edition of a work (SPEC 18, SPEC 20): the first one in the original language of the
 * book, else the first one in the given language, else the first one. Editions come with the
 * well-described ones first, so "first" is the best described one. The work page and the add to
 * library flow share this rule.
 */
export function pickDefaultEdition<
  T extends { isOriginalLanguage: boolean; language: string | null },
>(editions: readonly T[], locale: string): T | null {
  return (
    editions.find((edition) => edition.isOriginalLanguage) ??
    editions.find((edition) => edition.language === locale) ??
    editions[0] ??
    null
  );
}
