'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon, PlusIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import { StatusDropdown } from './StatusDropdown';
import { BOOK_STATUS_ORDER, type BookStatus } from './types';

type AddToLibraryButtonProps = {
  /** null = book not in the library yet. */
  status: BookStatus | null;
  labels: {
    /** Main button text, e.g. "Add to library". */
    add: string;
    /** Accessible name of the main button when it needs context. Must contain `add`. */
    addAriaLabel?: string;
    /** Accessible name of the chevron that opens the status menu. */
    menu: string;
    /** Translated label per status. */
    options: Record<BookStatus, string>;
  };
  onAdd: (status: BookStatus) => void;
  onChange: (status: BookStatus) => void;
  pending?: boolean;
  /** Shows the status of an added book without letting it change. */
  statusDisabled?: boolean;
  className?: string;
};

export function AddToLibraryButton({
  status,
  labels,
  onAdd,
  onChange,
  pending = false,
  statusDisabled = false,
  className,
}: AddToLibraryButtonProps) {
  if (status !== null) {
    return (
      <StatusDropdown
        status={status}
        options={labels.options}
        onChange={onChange}
        disabled={pending || statusDisabled}
        // The status stays readable while the control is disabled.
        className={cn(statusDisabled && 'disabled:opacity-80', className)}
      />
    );
  }

  return (
    <div className={className ? `inline-flex ${className}` : 'inline-flex'} aria-busy={pending}>
      <Button
        className="rounded-r-none"
        disabled={pending}
        aria-label={labels.addAriaLabel}
        onClick={() => onAdd('WANT_TO_READ')}
      >
        <PlusIcon />
        {labels.add}
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild disabled={pending}>
          <Button
            size="icon"
            aria-label={labels.menu}
            className="rounded-l-none border-l border-on-accent/30"
          >
            <ChevronDownIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {BOOK_STATUS_ORDER.map((value) => (
            <DropdownMenuItem key={value} onSelect={() => onAdd(value)}>
              {labels.options[value]}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
