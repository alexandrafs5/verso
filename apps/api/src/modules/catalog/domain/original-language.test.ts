import { describe, expect, it } from 'vitest';
import { type LanguageHint, originalLanguage } from './original-language';

const edition = (
  language: string | null,
  publishYear: number | null,
  translatedFrom: string | null = null,
): LanguageHint => ({ language, publishYear, translatedFrom });

describe('originalLanguage', () => {
  it('returns null for an empty list and for editions with no hints', () => {
    expect(originalLanguage([])).toBeNull();
    expect(
      originalLanguage([edition(null, null), edition('es', null), edition(null, 1990)]),
    ).toBeNull();
  });

  it('prefers translatedFrom over dates', () => {
    expect(
      originalLanguage([edition('ca', 2022, 'en'), edition('es', 1900), edition('en', 2000)]),
    ).toBe('en');
  });

  it('uses the most frequent translatedFrom, ties to the first seen', () => {
    expect(
      originalLanguage([
        edition('ca', 2020, 'fr'),
        edition('pt', 2019, 'en'),
        edition('es', 2018, 'en'),
        edition('de', 2017, 'fr'),
      ]),
    ).toBe('fr');
    expect(
      originalLanguage([
        edition('pt', 2019, 'en'),
        edition('es', 2018, 'en'),
        edition('de', 2017, 'fr'),
      ]),
    ).toBe('en');
  });

  it('falls back to the language of the oldest edition with a language and a year', () => {
    expect(originalLanguage([edition('en', 1994), edition('es', 1955), edition('ca', 2022)])).toBe(
      'es',
    );
    expect(originalLanguage([edition(null, 1900), edition('en', 1994)])).toBe('en');
    expect(originalLanguage([edition('es', null), edition('en', 1994)])).toBe('en');
  });

  it('breaks a year tie with the first edition in list order', () => {
    expect(originalLanguage([edition('es', 1955), edition('en', 1955)])).toBe('es');
  });

  it('accepts editions without a translatedFrom field', () => {
    expect(originalLanguage([{ language: 'es', publishYear: 1955 }])).toBe('es');
  });
});
