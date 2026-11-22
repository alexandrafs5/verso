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
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} className="m-0 text-sm text-danger">
          {error}
        </p>
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
