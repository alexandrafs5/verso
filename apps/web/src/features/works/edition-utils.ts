import type { EditionDto } from '@verso/shared';

/**
 * Default edition for the page (SPEC 18): the first one in the original language of the book,
 * else the first one in the UI language, else the first one. The API lists well-described
 * editions first, so "first" is the best described one.
 */
export function pickDefaultEdition(
  editions: readonly EditionDto[],
  locale: string,
): EditionDto | null {
  return (
    editions.find((edition) => edition.isOriginalLanguage) ??
    editions.find((edition) => edition.language === locale) ??
    editions[0] ??
    null
  );
}

/** Language name in the UI locale (`es` -> "Spanish"). Falls back to the raw code. */
export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
