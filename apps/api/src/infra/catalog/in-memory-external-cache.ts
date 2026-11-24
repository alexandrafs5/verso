import type { ExternalCacheStore } from './external-cache.js';

type Entry = { payload: unknown; expiresAt: number };

/** In-memory fake of the cache for unit tests. The clock is injectable to test expiry. */
export class InMemoryExternalCache implements ExternalCacheStore {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  get(key: string): Promise<unknown | null> {
    const entry = this.entries.get(key);
    if (!entry || entry.expiresAt <= this.now()) return Promise.resolve(null);
    return Promise.resolve(entry.payload);
  }

  set(key: string, payload: unknown, ttlSeconds: number): Promise<void> {
    this.entries.set(key, { payload, expiresAt: this.now() + ttlSeconds * 1000 });
    return Promise.resolve();
  }

  deleteExpired(): Promise<number> {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= this.now()) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return Promise.resolve(removed);
  }

  /** Test helper: seconds left before the key expires, or null when missing. */
  ttlSecondsLeft(key: string): number | null {
    const entry = this.entries.get(key);
    return entry ? Math.round((entry.expiresAt - this.now()) / 1000) : null;
  }

  get size(): number {
    return this.entries.size;
  }
}
