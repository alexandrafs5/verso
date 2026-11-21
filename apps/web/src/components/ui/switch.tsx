'use client';

import { Switch as SwitchPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

// Toggles are one of the two round shapes allowed by DESIGN.md (with avatars).
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-(--radius-round) border border-muted bg-raised p-0.5',
        'transition-colors duration-(--duration-fast)',
        'data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-4 rounded-(--radius-round) bg-muted transition-transform duration-(--duration-fast)',
          'data-[state=checked]:translate-x-5 data-[state=checked]:bg-on-accent',
        )}
      />
    </SwitchPrimitive.Root>
  );
}
