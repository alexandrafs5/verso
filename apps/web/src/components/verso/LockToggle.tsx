'use client';

import { LockIcon, LockOpenIcon } from '@/components/ui/icons';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Visibility } from './types';

type LockToggleProps = {
  visibility: Visibility;
  /** Explains the value, e.g. "Private - inherited from this book". Supplied by the caller. */
  tooltip: string;
  /** Visible text beside the icon, e.g. "Private". */
  label: string;
  onToggle: () => void;
  className?: string;
};

// Requires a TooltipProvider above it (app/providers.tsx provides one).
export function LockToggle({ visibility, tooltip, label, onToggle, className }: LockToggleProps) {
  const isPrivate = visibility === 'PRIVATE';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-pressed={isPrivate}
          onClick={onToggle}
          className={cn(
            'inline-flex min-h-11 items-center gap-1.5 rounded-(--radius-button) px-2 text-sm text-muted',
            'transition-colors duration-(--duration-fast) hover:bg-surface hover:text-foreground md:min-h-8',
            className,
          )}
        >
          {isPrivate ? <LockIcon /> : <LockOpenIcon />}
          {label}
        </button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
