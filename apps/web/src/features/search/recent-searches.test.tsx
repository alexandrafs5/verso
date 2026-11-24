import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RECENT_SEARCHES_KEY,
  RECENT_SEARCHES_MAX,
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
  removeRecentSearch,
  resetRecentSearchesMemory,
} from './recent-searches';
import { useRecentSearches } from './use-recent-searches';

beforeEach(() => {
  window.localStorage.clear();
  resetRecentSearchesMemory();
});
afterEach(() => vi.restoreAllMocks());

describe('recent searches helper', () => {
  it('stores newest first', () => {
    addRecentSearch('dune');
    addRecentSearch('pedro');
    expect(readRecentSearches()).toEqual(['pedro', 'dune']);
  });

  it('dedupes case-insensitively and moves the entry to the top', () => {
    addRecentSearch('Dune');
    addRecentSearch('pedro');
    addRecentSearch('DUNE');
    expect(readRecentSearches()).toEqual(['DUNE', 'pedro']);
  });

  it('keeps only the 8 newest', () => {
    for (let i = 1; i <= 10; i++) addRecentSearch(`query ${i}`);
    const list = readRecentSearches();
    expect(list).toHaveLength(RECENT_SEARCHES_MAX);
    expect(list[0]).toBe('query 10');
    expect(list).not.toContain('query 2');
  });

  it('trims and ignores text outside 2..200 characters', () => {
    addRecentSearch('  dune  ');
    addRecentSearch('a');
    addRecentSearch('x'.repeat(201));
    expect(readRecentSearches()).toEqual(['dune']);
  });

  it('removes one entry and clears all', () => {
    addRecentSearch('dune');
    addRecentSearch('pedro');
    expect(removeRecentSearch('DUNE')).toEqual(['pedro']);
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('["pedro"]');
    expect(clearRecentSearches()).toEqual([]);
    expect(readRecentSearches()).toEqual([]);
  });

  it('ignores corrupt data without throwing', () => {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, '{not json');
    expect(readRecentSearches()).toEqual([]);
    window.localStorage.setItem(RECENT_SEARCHES_KEY, '{"a":1}');
    expect(readRecentSearches()).toEqual([]);
  });

  it('drops invalid entries inside a valid array', () => {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['dune', 5, '', ' x ']));
    expect(readRecentSearches()).toEqual(['dune']);
  });

  it('replaces corrupt data on the next write', () => {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, '{not json');
    addRecentSearch('dune');
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('["dune"]');
  });

  it('keeps working in memory when localStorage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    addRecentSearch('dune');
    addRecentSearch('pedro');
    expect(readRecentSearches()).toEqual(['pedro', 'dune']);
  });
});

describe('useRecentSearches', () => {
  it('loads stored entries and updates on add, remove and clear', () => {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['dune']));
    const { result } = renderHook(() => useRecentSearches());
    expect(result.current.items).toEqual(['dune']);

    act(() => result.current.add('pedro'));
    expect(result.current.items).toEqual(['pedro', 'dune']);

    act(() => result.current.remove('dune'));
    expect(result.current.items).toEqual(['pedro']);

    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });
});
