import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, type = 'text', ...props }: ComponentProps<'input'>) {
  return (
    <input
      type={type}
      className={cn(
        'h-11 w-full min-w-0 rounded-(--radius-input) border border-border bg-surface px-3 text-base text-foreground md:h-10 md:text-sm',
        'transition-colors duration-(--duration-fast) placeholder:text-muted',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        'hover:border-muted focus-visible:border-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}
