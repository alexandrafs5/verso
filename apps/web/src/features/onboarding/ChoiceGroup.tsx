'use client';

import { type ReactNode, useId } from 'react';
import { cn } from '@/lib/utils';

export type Choice<T extends string> = {
  value: T;
  title: string;
  description?: string;
  /** Live preview, shown inside the card. */
  preview?: ReactNode;
};

type ChoiceGroupProps<T extends string> = {
  label: string;
  choices: readonly Choice<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  /** Is this card the selected one? Defaults to `choice.value === value`. */
  isSelected?: (choice: Choice<T>) => boolean;
};

// Native radios, so arrow keys, Tab and screen readers behave without extra code.
export function ChoiceGroup<T extends string>({
  label,
  choices,
  value,
  onChange,
  disabled,
  isSelected,
}: ChoiceGroupProps<T>) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-3">
      {choices.map((choice) => {
        const selected = isSelected ? isSelected(choice) : choice.value === value;
        return (
          <label
            key={choice.value}
            className={cn(
              'flex cursor-pointer flex-col gap-1 rounded-(--radius-card) border bg-surface p-4',
              'transition-colors duration-(--duration-fast) hover:border-muted',
              'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
              selected ? 'border-accent' : 'border-border',
              disabled && 'cursor-not-allowed opacity-50',
            )}
          >
            <input
              type="radio"
              name={name}
              value={choice.value}
              checked={selected}
              disabled={disabled}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            <span className="flex items-center gap-2 font-medium">
              {/* The selected state is a filled dot as well as a border color: color is never the only signal. */}
              <span
                aria-hidden="true"
                className={cn(
                  'inline-flex size-4 shrink-0 items-center justify-center rounded-(--radius-round) border',
                  selected ? 'border-accent' : 'border-border',
                )}
              >
                {selected ? <span className="size-2 rounded-(--radius-round) bg-accent" /> : null}
              </span>
              {choice.title}
            </span>
            {choice.description ? (
              <span className="text-sm text-muted">{choice.description}</span>
            ) : null}
            {choice.preview ? <span className="mt-2 block">{choice.preview}</span> : null}
          </label>
        );
      })}
    </div>
  );
}
