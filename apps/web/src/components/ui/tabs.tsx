'use client';

import { Tabs as TabsPrimitive } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Tabs({ className, ...props }: ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root className={cn('flex flex-col gap-4', className)} {...props} />;
}

export function TabsList({ className, ...props }: ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn('flex items-center gap-6 overflow-x-auto border-b border-border', className)}
      {...props}
    />
  );
}

// The active tab carries a 1px brass rule, same as the top-bar navigation.
export function TabsTrigger({ className, ...props }: ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        'relative inline-flex h-11 shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-muted',
        'transition-colors duration-(--duration-fast) hover:text-foreground',
        'data-[state=active]:text-foreground',
        'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent',
        'data-[state=active]:after:bg-brass',
        'disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content className={cn('outline-offset-4', className)} {...props} />;
}
