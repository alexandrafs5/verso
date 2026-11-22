'use client';

import { useCallback, useEffect, useState } from 'react';

export const RESEND_COOLDOWN_SECONDS = 60;
export const RESEND_UNTIL_KEY = 'verso:resend-until';

// Fallback when sessionStorage is unavailable.
let memoryUntil = 0;

function readUntil(): number {
  try {
    const raw = window.sessionStorage.getItem(RESEND_UNTIL_KEY);
    const parsed = raw === null ? 0 : Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  } catch {
    // Use the in-memory value.
  }
  return memoryUntil;
}

function writeUntil(until: number): void {
  memoryUntil = until;
  try {
    window.sessionStorage.setItem(RESEND_UNTIL_KEY, String(until));
  } catch {
    // Kept in memory only.
  }
}

function secondsUntil(until: number): number {
  return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

/**
 * 60 second resend cooldown. The end timestamp lives in sessionStorage so a reload keeps the
 * countdown. It is a UI courtesy only; real limits arrive with M2.6.
 */
export function useResendCooldown(): { secondsLeft: number; start: () => void } {
  const [until, setUntil] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // Read storage after mount so the server and first client render match.
  useEffect(() => {
    const stored = readUntil();
    setUntil(stored);
    setSecondsLeft(secondsUntil(stored));
  }, []);

  useEffect(() => {
    if (until <= Date.now()) return;
    const id = setInterval(() => {
      const left = secondsUntil(until);
      setSecondsLeft(left);
      if (left === 0) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [until]);

  const start = useCallback(() => {
    const next = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
    writeUntil(next);
    setUntil(next);
    setSecondsLeft(RESEND_COOLDOWN_SECONDS);
  }, []);

  return { secondsLeft, start };
}
