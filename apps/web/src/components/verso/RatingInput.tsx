'use client';

import { type KeyboardEvent, type MouseEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { isStarStyle, Stars } from './RatingDisplay';
import type { RatingStyle } from './types';

const MAX = 100;
const STAR_SIZE = 32;

// Step in 0-100 points. Decimal 1-10 uses 10 (one whole point of the 10 scale); hundred uses 1.
const STEP: Record<RatingStyle, number> = {
  STARS_WHOLE: 20,
  STARS_HALF: 10,
  STARS_QUARTER: 5,
  DECIMAL_10: 10,
  HUNDRED: 1,
};

type RatingInputLabels = {
  clear: string;
  /** Spoken value for the star picker; n is the star count (e.g. 2.5). */
  star: (n: number) => string;
  /** Accessible name of the star picker or the range slider. */
  slider: string;
  /** Accessible name of the numeric field. */
  field: string;
};

type RatingInputProps = {
  /** 0-100, or null when unrated. */
  value: number | null;
  style: RatingStyle;
  onChange: (value: number | null) => void;
  labels: RatingInputLabels;
  className?: string;
};

const clamp = (n: number) => Math.min(MAX, Math.max(0, n));

function formatField(value: number | null, style: RatingStyle): string {
  if (value === null) return '';
  return style === 'DECIMAL_10' ? (value / 10).toFixed(1) : String(value);
}

// Returns the 0-100 value for a typed string, null when empty, undefined when invalid.
function parseField(text: string, style: RatingStyle): number | null | undefined {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return undefined;
  const points = style === 'DECIMAL_10' ? Math.round(n * 10) : Math.round(n);
  return points >= 0 && points <= MAX ? points : undefined;
}

export function RatingInput({ value, style, onChange, labels, className }: RatingInputProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      {isStarStyle(style) ? (
        <StarPicker value={value} step={STEP[style]} onChange={onChange} labels={labels} />
      ) : (
        <NumericPicker value={value} style={style} onChange={onChange} labels={labels} />
      )}
      <Button variant="ghost" size="sm" disabled={value === null} onClick={() => onChange(null)}>
        {labels.clear}
      </Button>
    </div>
  );
}

type PickerProps = Pick<RatingInputProps, 'value' | 'onChange' | 'labels'>;

function StarPicker({ value, step, onChange, labels }: PickerProps & { step: number }) {
  const ref = useRef<HTMLDivElement>(null);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const next = Math.max(step, Math.min(MAX, Math.ceil((fraction * MAX) / step) * step));
    onChange(next === value ? null : next);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      event.preventDefault();
      onChange(clamp((value ?? 0) + step));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      event.preventDefault();
      if (value !== null) onChange(clamp(value - step));
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      onChange(null);
    }
  }

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={0}
      aria-label={labels.slider}
      aria-valuemin={0}
      aria-valuemax={MAX}
      aria-valuenow={value ?? 0}
      aria-valuetext={value === null ? undefined : labels.star(value / 20)}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      className="inline-flex cursor-pointer touch-manipulation py-1.5"
    >
      <Stars value={value ?? 0} size={STAR_SIZE} />
    </div>
  );
}

function NumericPicker({ value, style, onChange, labels }: PickerProps & { style: RatingStyle }) {
  const [draft, setDraft] = useState(() => formatField(value, style));
  const [lastValue, setLastValue] = useState(value);

  // Follow external changes (clear, parent reset) without clobbering what the user is typing.
  if (value !== lastValue) {
    setLastValue(value);
    if (parseField(draft, style) !== value) setDraft(formatField(value, style));
  }

  const parsed = parseField(draft, style);

  return (
    <>
      <input
        type="range"
        min={0}
        max={MAX}
        step={style === 'DECIMAL_10' ? 10 : 1}
        value={value ?? 0}
        aria-label={labels.slider}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-11 w-40 accent-brass"
      />
      <Input
        type="text"
        inputMode="decimal"
        value={draft}
        aria-label={labels.field}
        aria-invalid={parsed === undefined}
        onChange={(event) => {
          const text = event.target.value;
          setDraft(text);
          const next = parseField(text, style);
          if (next !== undefined) onChange(next);
        }}
        className="w-20 tabular-nums"
      />
    </>
  );
}
