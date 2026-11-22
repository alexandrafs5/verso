'use client';

import { useEffect, useRef } from 'react';

/**
 * Keeps keyboard focus where it was when a form is disabled during a request. A focused control
 * that becomes `disabled` loses focus, so after a failed submit the next Tab would restart at the
 * top of the page. When `busy` ends and focus is on nothing, it returns to the last focused element.
 */
export function useRestoreFocus(busy: boolean): void {
  const last = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement) last.current = event.target;
    };
    document.addEventListener('focusin', onFocusIn);
    return () => document.removeEventListener('focusin', onFocusIn);
  }, []);

  const wasBusy = useRef(false);
  useEffect(() => {
    if (busy) {
      wasBusy.current = true;
      return;
    }
    if (!wasBusy.current) return;
    wasBusy.current = false;

    const element = last.current;
    const focusLost = document.activeElement === null || document.activeElement === document.body;
    const usable = element?.isConnected && !(element as HTMLButtonElement).disabled;
    if (focusLost && usable) element?.focus();
  }, [busy]);
}
