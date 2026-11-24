/** Key-value cache with a time to live. Backed by the ExternalCache table in production. */
export interface ExternalCacheStore {
  /** Returns the stored payload, or null when the key is missing or expired. */
  get(key: string): Promise<unknown | null>;
  /** Stores the payload, replacing any existing entry for the key. */
  set(key: string, payload: unknown, ttlSeconds: number): Promise<void>;
  /** Removes expired entries and returns how many were removed. */
  deleteExpired(): Promise<number>;
}

export const EXTERNAL_CACHE_STORE = Symbol('EXTERNAL_CACHE_STORE');
