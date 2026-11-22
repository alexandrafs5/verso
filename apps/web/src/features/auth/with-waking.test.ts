import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getSnapshot } from '@/lib/waking-state';
import { withWaking } from './with-waking';

describe('withWaking', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays idle for a fast request', async () => {
    const result = await withWaking(() => Promise.resolve('ok'), 3000);
    expect(result).toBe('ok');
    expect(getSnapshot()).toBe('idle');
  });

  it('marks waking after the threshold and releases when the request ends', async () => {
    let finish: (value: string) => void = () => {};
    const pending = withWaking(() => new Promise<string>((resolve) => (finish = resolve)), 3000);

    await vi.advanceTimersByTimeAsync(2999);
    expect(getSnapshot()).toBe('idle');
    await vi.advanceTimersByTimeAsync(1);
    expect(getSnapshot()).toBe('waking');

    finish('done');
    await expect(pending).resolves.toBe('done');
    expect(getSnapshot()).toBe('idle');
  });

  it('releases the waking mark when the request rejects', async () => {
    let fail: (reason: Error) => void = () => {};
    const pending = withWaking(() => new Promise<string>((_, reject) => (fail = reject)), 1000);
    const assertion = expect(pending).rejects.toThrow('boom');

    await vi.advanceTimersByTimeAsync(1000);
    expect(getSnapshot()).toBe('waking');
    fail(new Error('boom'));
    await assertion;
    expect(getSnapshot()).toBe('idle');
  });
});
