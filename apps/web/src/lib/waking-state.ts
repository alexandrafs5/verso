import { useSyncExternalStore } from 'react';

export type WakingState = 'idle' | 'waking';

type Listener = () => void;

const listeners = new Set<Listener>();
let wakingCount = 0;
let snapshot: WakingState = 'idle';

function emit(): void {
  const next: WakingState = wakingCount > 0 ? 'waking' : 'idle';
  if (next === snapshot) return;
  snapshot = next;
  for (const listener of listeners) listener();
}

/**
 * Marks one request as waking. Returns a release function; the state is
 * `waking` while at least one request holds a mark.
 */
export function markWaking(): () => void {
  let released = false;
  wakingCount += 1;
  emit();
  return () => {
    if (released) return;
    released = true;
    wakingCount -= 1;
    emit();
  };
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): WakingState {
  return snapshot;
}

function getServerSnapshot(): WakingState {
  return 'idle';
}

export function useWakingState(): WakingState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
