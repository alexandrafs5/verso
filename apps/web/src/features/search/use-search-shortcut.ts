'use client';

import { useEffect, useRef } from 'react';

export const SHORTCUT_MIN_WIDTH_QUERY = '(min-width: 768px)';

function isDesktopWidth(): boolean {
  // jsdom and old browsers may not have matchMedia: treat them as desktop.
  return window.matchMedia?.(SHORTCUT_MIN_WIDTH_QUERY).matches ?? true;
}

/**
 * Ctrl+K and Cmd+K on any platform. Ignored below 768px, where the top bar has no field.
 * The browser's own handler is blocked only when the field is not already focused.
 */
export function useSearchShortcut(onTrigger: () => void, isFieldFocused: () => boolean) {
  const trigger = useRef(onTrigger);
  const focused = useRef(isFieldFocused);
  trigger.current = onTrigger;
  focused.current = isFieldFocused;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
      if (event.altKey || event.shiftKey || !isDesktopWidth()) return;
      if (!focused.current()) event.preventDefault();
      trigger.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
