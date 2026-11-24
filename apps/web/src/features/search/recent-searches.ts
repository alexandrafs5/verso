import { SEARCH_QUERY_MAX } from '@verso/shared';

export const RECENT_SEARCHES_KEY = 'verso:recent-searches:v1';
export const RECENT_SEARCHES_MAX = 8;
export const RECENT_SEARCH_MIN_LENGTH = 2;

// Used when localStorage is blocked, so recents still last until reload.
let memory: string[] = [];

function isValidEntry(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= RECENT_SEARCH_MIN_LENGTH &&
    value.length <= SEARCH_QUERY_MAX &&
    value === value.trim()
  );
}

export function readRecentSearches(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_SEARCHES_KEY);
    if (raw === null) return memory;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, RECENT_SEARCHES_MAX);
  } catch {
    return memory;
  }
}

function write(list: string[]): string[] {
  memory = list;
  try {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(list));
  } catch {
    // Storage blocked or full: the in-memory copy still serves this session.
  }
  return list;
}

/** Newest first, case-insensitive dedupe, capped. Ignores text outside the valid length. */
export function addRecentSearch(text: string): string[] {
  const entry = text.trim();
  const current = readRecentSearches();
  if (!isValidEntry(entry)) return current;
  const lower = entry.toLowerCase();
  const rest = current.filter((item) => item.toLowerCase() !== lower);
  return write([entry, ...rest].slice(0, RECENT_SEARCHES_MAX));
}

export function removeRecentSearch(text: string): string[] {
  const lower = text.toLowerCase();
  return write(readRecentSearches().filter((item) => item.toLowerCase() !== lower));
}

export function clearRecentSearches(): string[] {
  return write([]);
}

/** Test helper: forget the in-memory fallback. */
export function resetRecentSearchesMemory(): void {
  memory = [];
}
