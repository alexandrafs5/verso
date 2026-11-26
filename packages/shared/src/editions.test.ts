import { describe, expect, it } from 'vitest';
import { pickDefaultEdition } from './editions.js';

const edition = (id: string, language: string | null, isOriginalLanguage = false) => ({
  id,
  language,
  isOriginalLanguage,
});

describe('pickDefaultEdition', () => {
  it('prefers the first edition in the original language', () => {
    const list = [edition('en', 'en'), edition('es', 'es', true), edition('es2', 'es', true)];
    expect(pickDefaultEdition(list, 'en')?.id).toBe('es');
  });

  it('falls back to the first edition in the given language', () => {
    const list = [edition('fr', 'fr'), edition('en', 'en'), edition('en2', 'en')];
    expect(pickDefaultEdition(list, 'en')?.id).toBe('en');
  });

  it('falls back to the first edition', () => {
    expect(pickDefaultEdition([edition('fr', 'fr'), edition('none', null)], 'es')?.id).toBe('fr');
  });

  it('returns null for an empty list', () => {
    expect(pickDefaultEdition([], 'en')).toBeNull();
  });
});
