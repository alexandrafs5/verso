import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const linkClass =
  'rounded-(--radius-chip) font-medium text-accent-text underline-offset-4 outline-none hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Props to spread on an input so it points at its error message. */
export function fieldA11y(id: string, hasError: boolean) {
  return {
    id,
    'aria-invalid': hasError || undefined,
    'aria-describedby': hasError ? `${id}-error` : undefined,
  } as const;
}

type AuthFieldProps = {
  id: string;
  label: string;
  error?: string;
  /** Sits on the label row, right-aligned (for example "Forgot password?"). */
  labelAction?: ReactNode;
  children: ReactNode;
};

export function AuthField({ id, label, error, labelAction, children }: AuthFieldProps) {
  return (
    // DOM order is label, control, error, action, so Tab goes input first and the action
    // (for example "Forgot password?") after it. The grid puts the action back on the label row.
    <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5">
      <label htmlFor={id} className="col-start-1 row-start-1 self-baseline text-sm font-medium">
        {label}
      </label>
      <div className="col-span-2 row-start-2">{children}</div>
      {error ? (
        <p id={`${id}-error`} className="col-span-2 row-start-3 m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {labelAction ? (
        <div className="col-start-2 row-start-1 self-baseline">{labelAction}</div>
      ) : null}
    </div>
  );
}

type AuthAlertProps = {
  tone: 'error' | 'info';
  title?: string;
  children: ReactNode;
};

// Errors interrupt (role="alert"); the verification notice is polite (role="status").
export function AuthAlert({ tone, title, children }: AuthAlertProps) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'mb-5 rounded-(--radius-card) border px-3.5 py-3 text-sm',
        tone === 'error' ? 'border-danger text-danger' : 'border-border bg-raised text-foreground',
      )}
    >
      {title ? <p className="m-0 mb-1 font-medium">{title}</p> : null}
      <p className="m-0">{children}</p>
    </div>
  );
}

export function OrDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-sm text-muted" role="separator">
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
      {label}
      <span aria-hidden="true" className="h-px flex-1 bg-border" />
    </div>
  );
}
