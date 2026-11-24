import { describe, expect, it } from 'vitest';
import { InMemoryExternalCache } from './in-memory-external-cache.js';

describe('InMemoryExternalCache', () => {
  it('returns null for a missing key', async () => {
    expect(await new InMemoryExternalCache().get('x')).toBeNull();
  });

  it('stores, replaces and expires entries', async () => {
    let now = 1_000_000;
    const cache = new InMemoryExternalCache(() => now);
    await cache.set('k', { v: 1 }, 10);
    expect(await cache.get('k')).toEqual({ v: 1 });
    await cache.set('k', { v: 2 }, 100);
    expect(await cache.get('k')).toEqual({ v: 2 });
    expect(cache.ttlSecondsLeft('k')).toBe(100);

    now += 100_000;
    expect(await cache.get('k')).toBeNull();
  });

  it('deleteExpired removes only expired entries', async () => {
    let now = 0;
    const cache = new InMemoryExternalCache(() => now);
    await cache.set('old', 1, 10);
    await cache.set('fresh', 2, 1000);
    now = 20_000;

    expect(await cache.deleteExpired()).toBe(1);
    expect(cache.size).toBe(1);
    expect(await cache.get('fresh')).toBe(2);
  });
});
