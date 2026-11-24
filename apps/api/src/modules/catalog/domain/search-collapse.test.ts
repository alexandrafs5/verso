import { describe, expect, it } from 'vitest';
import type { WorkSearchResult } from '../../../infra/catalog/catalog-provider';
import { mapSearchDoc } from '../../../infra/catalog/open-library-mappers';
import { loadFixture } from '../../../infra/catalog/test-fixtures';
import { collapseSearchResults, normalizeTitle } from './search-collapse';

const RULFO = { olAuthorKey: 'OL199285A', name: 'Juan Rulfo' };

function result(
  key: string,
  title: string,
  editionCount: number,
  overrides: Partial<WorkSearchResult> = {},
): WorkSearchResult {
  return {
    olWorkKey: key,
    title,
    authors: [RULFO],
    firstPublishYear: null,
    coverUrl: null,
    editionCount,
    languages: [],
    ...overrides,
  };
}

const first = { guardVisible: true };
const later = { guardVisible: false };

describe('normalizeTitle', () => {
  it('ignores case and accents', () => {
    expect(normalizeTitle('Pedro Páramo')).toBe('pedro paramo');
    expect(normalizeTitle('PEDRO PARAMO')).toBe('pedro paramo');
  });

  it('cuts a subtitle after ":" or " / "', () => {
    expect(normalizeTitle('Dune: Messiah')).toBe('dune');
    expect(normalizeTitle('Pedro Páramo / El llano en llamas')).toBe('pedro paramo');
  });

  it('removes parenthetical text', () => {
    expect(normalizeTitle('Pedro Páramo (Wittliff Gallery Series)')).toBe('pedro paramo');
  });

  it('removes a trailing author name, with or without "de" or a comma', () => {
    const authors = ['Juan Rulfo'];
    expect(normalizeTitle('Pedro Páramo, Juan Rulfo', authors)).toBe('pedro paramo');
    expect(normalizeTitle('Pedro Páramo de Juan Rulfo', authors)).toBe('pedro paramo');
    expect(normalizeTitle('Pedro Páramo Juan Rulfo', authors)).toBe('pedro paramo');
  });

  it('keeps the author name when it is the whole title or not an author of the result', () => {
    expect(normalizeTitle('Juan Rulfo', ['Juan Rulfo'])).toBe('juan rulfo');
    expect(normalizeTitle('Pedro Páramo, Juan Rulfo', ['Someone Else'])).toBe(
      'pedro paramo juan rulfo',
    );
  });

  it('does not cut a title that merely contains a word of the author name', () => {
    expect(normalizeTitle('La poesía en Pedro Páramo', ['Juan Rulfo'])).toBe(
      'la poesia en pedro paramo',
    );
  });
});

describe('collapseSearchResults: merging', () => {
  it('merges the same normalized title and first author key', () => {
    const out = collapseSearchResults(
      [
        result('OL1W', 'Pedro Páramo', 135),
        result('OL2W', 'Pedro Paramo', 2),
        result('OL3W', 'Pedro Páramo, Juan Rulfo', 1),
      ],
      first,
    );
    expect(out.items).toHaveLength(1);
    expect(out.items[0]).toMatchObject({ olWorkKey: 'OL1W', editionCount: 138 });
    expect(out.moreMatches).toEqual([]);
  });

  it('keeps results with the same title but another first author key apart', () => {
    const other = { olAuthorKey: 'OL1A', name: 'Other Person' };
    const out = collapseSearchResults(
      [result('OL1W', 'Pedro Páramo', 10), result('OL2W', 'Pedro Páramo', 5, { authors: [other] })],
      first,
    );
    expect(out.items.map((i) => i.olWorkKey)).toEqual(['OL1W', 'OL2W']);
  });

  it('uses the member with most editions as the representative and sums the counts', () => {
    const out = collapseSearchResults(
      [
        result('OL1W', 'Pedro Páramo', 5, { firstPublishYear: 1990 }),
        result('OL2W', 'Pedro Páramo', 20, { firstPublishYear: 1955 }),
      ],
      first,
    );
    expect(out.items).toEqual([
      expect.objectContaining({ olWorkKey: 'OL2W', firstPublishYear: 1955, editionCount: 25 }),
    ]);
  });

  it('breaks a tie in favour of the first member', () => {
    const out = collapseSearchResults(
      [result('OL1W', 'Pedro Páramo', 4), result('OL2W', 'Pedro Páramo', 4)],
      first,
    );
    expect(out.items[0]?.olWorkKey).toBe('OL1W');
  });

  it('falls back to a cover from another member', () => {
    const cover = 'https://covers.openlibrary.org/b/id/1-M.jpg';
    const out = collapseSearchResults(
      [result('OL1W', 'Pedro Páramo', 20), result('OL2W', 'Pedro Paramo', 3, { coverUrl: cover })],
      first,
    );
    expect(out.items[0]?.coverUrl).toBe(cover);
  });

  it('keeps the representative cover when it has one', () => {
    const out = collapseSearchResults(
      [
        result('OL1W', 'Pedro Páramo', 20, { coverUrl: 'a' }),
        result('OL2W', 'Pedro Paramo', 3, { coverUrl: 'b' }),
      ],
      first,
    );
    expect(out.items[0]?.coverUrl).toBe('a');
  });

  it('puts a group at the position of its first member and does not sort again', () => {
    const out = collapseSearchResults(
      [
        result('OL1W', 'Alpha', 9, { authors: [{ olAuthorKey: 'OL1A', name: 'A' }] }),
        result('OL2W', 'Beta', 8, { authors: [{ olAuthorKey: 'OL2A', name: 'B' }] }),
        result('OL3W', 'Alpha', 7, { authors: [{ olAuthorKey: 'OL1A', name: 'A' }] }),
      ],
      first,
    );
    expect(out.items.map((i) => i.olWorkKey)).toEqual(['OL1W', 'OL2W']);
    expect(out.items[0]?.editionCount).toBe(16);
  });

  it('groups results without authors by title alone', () => {
    const out = collapseSearchResults(
      [result('OL1W', 'Orphan', 3, { authors: [] }), result('OL2W', 'orphan', 2, { authors: [] })],
      first,
    );
    expect(out.items).toHaveLength(1);
  });

  it('does not mutate the input', () => {
    const input = [result('OL1W', 'Pedro Páramo', 5), result('OL2W', 'Pedro Paramo', 2)];
    const copy = structuredClone(input);
    collapseSearchResults(input, first);
    expect(input).toEqual(copy);
  });

  it('returns two empty lists for an empty page', () => {
    expect(collapseSearchResults([], first)).toEqual({ items: [], moreMatches: [] });
    expect(collapseSearchResults([], later)).toEqual({ items: [], moreMatches: [] });
  });
});

describe('collapseSearchResults: fold', () => {
  const tail = (n: number) =>
    result(`OL${n}W`, `Study ${n}`, 1, { authors: [{ olAuthorKey: `OL${n}A`, name: `S${n}` }] });

  it('folds groups with 1 edition when another group has more', () => {
    const out = collapseSearchResults(
      [result('OL1W', 'Pedro Páramo', 12), tail(7), tail(8)],
      first,
    );
    expect(out.items.map((i) => i.olWorkKey)).toEqual(['OL1W']);
    expect(out.moreMatches.map((i) => i.olWorkKey)).toEqual(['OL7W', 'OL8W']);
  });

  it('counts an editionCount of 0 as 1', () => {
    const out = collapseSearchResults(
      [result('OL1W', 'Pedro Páramo', 12), result('OL9W', 'Unknown count', 0, { authors: [] })],
      first,
    );
    expect(out.moreMatches.map((i) => i.olWorkKey)).toEqual(['OL9W']);
  });

  it('folds nothing on the first page when every group has 1 edition', () => {
    const out = collapseSearchResults([tail(7), tail(8)], first);
    expect(out.items).toHaveLength(2);
    expect(out.moreMatches).toEqual([]);
  });

  it('folds everything with 1 edition on a later page, even when items ends up empty', () => {
    const out = collapseSearchResults([tail(7), tail(8)], later);
    expect(out.items).toEqual([]);
    expect(out.moreMatches).toHaveLength(2);
  });

  it('merges before folding: two 1-edition members of one group make a 2-edition item', () => {
    const out = collapseSearchResults(
      [
        result('OL1W', 'Pedro Páramo', 12, { authors: [] }),
        result('OL5W', 'Same Book', 1),
        result('OL6W', 'Same book', 1),
      ],
      first,
    );
    expect(out.items.map((i) => i.olWorkKey)).toEqual(['OL1W', 'OL5W']);
    expect(out.moreMatches).toEqual([]);
  });

  it('keeps provider order in both lists', () => {
    const out = collapseSearchResults(
      [
        tail(7),
        result('OL1W', 'Big', 30, { authors: [] }),
        tail(8),
        result('OL2W', 'Mid', 4, { authors: [] }),
      ],
      first,
    );
    expect(out.items.map((i) => i.olWorkKey)).toEqual(['OL1W', 'OL2W']);
    expect(out.moreMatches.map((i) => i.olWorkKey)).toEqual(['OL7W', 'OL8W']);
  });
});

describe('collapseSearchResults: pedro paramo fixture', () => {
  const docs = loadFixture<{ docs: unknown[] }>('search-pedro-paramo.json').docs;
  const mapped = docs.flatMap((doc) => mapSearchDoc(doc) ?? []);

  it('returns one Pedro Páramo item by Juan Rulfo with the merged edition count', () => {
    const out = collapseSearchResults(mapped, first);
    const matches = out.items.filter(
      (item) =>
        normalizeTitle(
          item.title,
          item.authors.map((a) => a.name),
        ) === 'pedro paramo' && item.authors[0]?.olAuthorKey === 'OL199285A',
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.olWorkKey).toBe('OL1731119W');
    expect(matches[0]?.editionCount).toBeGreaterThanOrEqual(160);
  });

  it('folds the 1-edition tail and drops nothing', () => {
    const out = collapseSearchResults(mapped, first);
    expect(out.items.length).toBeLessThan(mapped.length);
    expect(out.moreMatches.length).toBeGreaterThan(0);
    expect(out.moreMatches.every((m) => m.editionCount <= 1)).toBe(true);
    const total = (list: WorkSearchResult[]) => list.reduce((sum, m) => sum + m.editionCount, 0);
    expect(total(out.items) + total(out.moreMatches)).toBe(total(mapped));
  });
});
