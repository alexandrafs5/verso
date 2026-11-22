'use client';

import { useEffect, useRef } from 'react';

/**
 * Fire-and-forget `GET /api/health` on mount so a sleeping API starts waking while the user
 * types (ARCHITECTURE §3). The result is ignored and never blocks rendering.
 */
export function useWakeUpPing(): void {
  // The ref survives the StrictMode remount, so development also sends one request.
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    fetch('/api/health', { cache: 'no-store' }).catch(() => {});
  }, []);
}
