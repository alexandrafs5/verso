'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  RECENT_SEARCHES_KEY,
  addRecentSearch,
  clearRecentSearches,
  readRecentSearches,
  removeRecentSearch,
} from './recent-searches';

/** Recent searches for this browser. Reads after mount so server and client markup match. */
export function useRecentSearches() {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    setItems(readRecentSearches());
    const onStorage = (event: StorageEvent) => {
      if (event.key === RECENT_SEARCHES_KEY || event.key === null) setItems(readRecentSearches());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const add = useCallback((text: string) => setItems(addRecentSearch(text)), []);
  const remove = useCallback((text: string) => setItems(removeRecentSearch(text)), []);
  const clear = useCallback(() => setItems(clearRecentSearches()), []);

  return { items, add, remove, clear };
}
