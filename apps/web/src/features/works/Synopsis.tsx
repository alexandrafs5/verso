'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { focusRing } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

type SynopsisProps = {
  text: string;
  readMoreLabel: string;
  readLessLabel: string;
  className?: string;
};

/**
 * Text clamped to 5 lines. The toggle shows only when the text overflows the clamp, and it
 * stays once expanded so the text can be collapsed again (SPEC 18). Also used for author bios.
 */
export function Synopsis({ text, readMoreLabel, readLessLabel, className }: SynopsisProps) {
  const id = useId();
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    // Measure only while clamped: an expanded paragraph never overflows.
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const measure = () => setOverflowing(el.scrollHeight > el.clientHeight + 1);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    <div className={className}>
      <p
        ref={ref}
        id={id}
        className={cn('break-words whitespace-pre-line', !expanded && 'line-clamp-5')}
      >
        {text}
      </p>
      {overflowing || expanded ? (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((value) => !value)}
          className={cn(
            'mt-2 inline-flex min-h-11 items-center text-sm text-accent-text underline-offset-4 hover:underline md:min-h-0',
            focusRing,
          )}
        >
          {expanded ? readLessLabel : readMoreLabel}
        </button>
      ) : null}
    </div>
  );
}
