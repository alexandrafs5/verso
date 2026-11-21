import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Shape it like the final content (cover rectangle, text line) with className.
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse rounded-(--radius-card) bg-border motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
