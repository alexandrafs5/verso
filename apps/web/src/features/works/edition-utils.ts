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

/**
 * The description to show (SPEC 18). Open Library has one description per work, usually English,
 * and no translation. Some editions carry a blurb in their own language, so outside English the
 * best described edition in the UI language wins, then the work description. In English the work
 * description wins, then an English edition blurb.
 */
export function pickDescription(
  workDescription: string | null,
  editions: readonly EditionDto[],
  locale: string,
): string | null {
  const fromEdition = editions.find(
    (edition) => edition.language === locale && edition.description,
  )?.description;
  const text =
    locale === 'en' ? (workDescription ?? fromEdition) : (fromEdition ?? workDescription);
  return text ?? null;
}

/**
 * Language name in the UI locale, starting with a capital (`ca` in Spanish is "Catalán", not
 * "catalán", which is how `Intl.DisplayNames` writes it). Falls back to the raw code.
 */
export function languageName(code: string, locale: string): string {
  try {
    const name = new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
    const [first = '', ...rest] = [...name];
    return first.toLocaleUpperCase(locale) + rest.join('');
  } catch {
    return code;
  }
}
