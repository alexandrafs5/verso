import { describe, expect, it } from 'vitest';
import { COVER_TONES, pickCoverTone } from './generated-cover.js';

describe('pickCoverTone', () => {
  it('is stable across repeated calls', () => {
    expect(pickCoverTone('Dune')).toBe(pickCoverTone('Dune'));
  });

  it('ignores case and surrounding spaces', () => {
    expect(pickCoverTone('  The Hobbit ')).toBe(pickCoverTone('the hobbit'));
    expect(pickCoverTone('DUNE')).toBe(pickCoverTone('dune'));
  });

  it('returns only known tones', () => {
    for (const title of ['Dune', 'Emma', 'Ulysses', 'Cien años de soledad', '日本語']) {
      expect(COVER_TONES).toContain(pickCoverTone(title));
    }
  });

  it('uses all six tones across 200 distinct titles', () => {
    const used = new Set<string>();
    for (let i = 0; i < 200; i++) used.add(pickCoverTone(`Book title ${i}`));
    expect(used.size).toBe(COVER_TONES.length);
  });

  it('maps empty and blank titles to the first tone', () => {
    expect(pickCoverTone('')).toBe('wine');
    expect(pickCoverTone('   ')).toBe('wine');
  });
});
