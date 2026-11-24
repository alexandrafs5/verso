import type { EditionDto } from '@verso/shared';

/**
 * Default edition for the page: the first one in the UI language, else the first one (the API
 * already lists well-described editions first). Never a language the reader did not ask for
 * when one in their language exists.
 */
export function pickDefaultEdition(
  editions: readonly EditionDto[],
  locale: string,
): EditionDto | null {
  return editions.find((edition) => edition.language === locale) ?? editions[0] ?? null;
}

/** Language name in the UI locale (`es` -> "Spanish"). Falls back to the raw code. */
export function languageName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
  } catch {
    return code;
  }
}
