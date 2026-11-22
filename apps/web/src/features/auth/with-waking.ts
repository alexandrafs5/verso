import { WAKING_THRESHOLD_MS } from '@/lib/api-client';
import { markWaking } from '@/lib/waking-state';

/**
 * Runs a request that does not go through `api-client` (the Better Auth client) and marks the
 * waking state if it takes longer than the threshold, so the waking banner shows (ARCHITECTURE §3).
 */
export async function withWaking<T>(
  run: () => Promise<T>,
  thresholdMs: number = WAKING_THRESHOLD_MS,
): Promise<T> {
  let release: (() => void) | null = null;
  const timer = setTimeout(() => {
    release = markWaking();
  }, thresholdMs);
  try {
    return await run();
  } finally {
    clearTimeout(timer);
    (release as (() => void) | null)?.();
  }
}
