import type { EditionDto } from '@verso/shared';
import { describe, expect, it } from 'vitest';
import { languageName, pickDefaultEdition, pickDescription } from './edition-utils';

describe('languageName', () => {
  it('starts every language name with a capital letter in Spanish', () => {
    expect(languageName('ca', 'es')).toBe('Catalán');
    expect(languageName('en', 'es')).toBe('Inglés');
    expect(languageName('es', 'es')).toBe('Español');
    expect(languageName('pt', 'es')).toBe('Portugués');
  });

  it('keeps English names as they are', () => {
    expect(languageName('es', 'en')).toBe('Spanish');
    expect(languageName('ca', 'en')).toBe('Catalan');
  });

  it('falls back to the raw code for a code Intl does not know', () => {
    expect(languageName('zz-invalid-code-!', 'en')).toBe('zz-invalid-code-!');
  });
});

const edition = (ref: string, language: string | null, isOriginalLanguage = false): EditionDto => ({
  ref,
  title: 'T',
  isbn10: null,
  isbn13: null,
  publisher: null,
  publishYear: null,
  language,
  pageCount: null,
  format: 'PAPERBACK',
  coverUrl: null,
  isOriginalLanguage,
  description: null,
});

describe('pickDefaultEdition', () => {
  it('takes the original-language edition, then the UI language, then the first', () => {
    const list = [edition('a', 'ca'), edition('b', 'es'), edition('c', 'en', true)];
    expect(pickDefaultEdition(list, 'es')?.ref).toBe('c');
    expect(pickDefaultEdition([edition('a', 'ca'), edition('b', 'es')], 'es')?.ref).toBe('b');
    expect(pickDefaultEdition([edition('a', 'ca'), edition('b', 'de')], 'es')?.ref).toBe('a');
    expect(pickDefaultEdition([], 'es')).toBeNull();
  });
});

describe('pickDescription', () => {
  const withText = (ref: string, language: string | null, description: string | null) => ({
    ...edition(ref, language),
    description,
  });

  it('prefers a blurb of an edition in the UI language outside English', () => {
    const editions = [
      withText('a', 'en', 'English blurb'),
      withText('b', 'es', 'Sinopsis en español'),
    ];
    expect(pickDescription('Work description', editions, 'es')).toBe('Sinopsis en español');
  });

  it('falls back to the work description when no edition in the UI language has a blurb', () => {
    const editions = [withText('a', 'es', null), withText('b', 'en', 'English blurb')];
    expect(pickDescription('Work description', editions, 'es')).toBe('Work description');
    expect(pickDescription('Work description', [], 'es')).toBe('Work description');
  });

  it('keeps the work description in English, and uses an English blurb only without one', () => {
    const editions = [withText('a', 'en', 'English blurb')];
    expect(pickDescription('Work description', editions, 'en')).toBe('Work description');
    expect(pickDescription(null, editions, 'en')).toBe('English blurb');
  });

  it('returns null when there is no text at all', () => {
    expect(pickDescription(null, [withText('a', 'es', null)], 'es')).toBeNull();
  });
});
