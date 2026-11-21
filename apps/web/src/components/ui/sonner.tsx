'use client';

import { useTheme } from 'next-themes';
import type { CSSProperties } from 'react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Toasts: bottom-center, auto-dismiss in 4s (DESIGN.md States). Fire them with `toast()` from 'sonner'.
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-center"
      duration={4000}
      style={
        {
          '--normal-bg': 'var(--surface-raised)',
          '--normal-text': 'var(--text-primary)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius-card)',
          '--success-bg': 'var(--surface-raised)',
          '--success-text': 'var(--text-primary)',
          '--success-border': 'var(--success)',
          '--error-bg': 'var(--surface-raised)',
          '--error-text': 'var(--text-primary)',
          '--error-border': 'var(--danger)',
          fontFamily: 'var(--font-ui)',
        } as CSSProperties
      }
      {...props}
    />
  );
}
