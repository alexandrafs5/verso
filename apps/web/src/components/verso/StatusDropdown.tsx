'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDownIcon } from '@/components/ui/icons';
import { BOOK_STATUS_ORDER, type BookStatus } from './types';

type StatusDropdownProps = {
  status: BookStatus;
  /** Translated label per status, supplied by the caller. */
  options: Record<BookStatus, string>;
  onChange: (status: BookStatus) => void;
  disabled?: boolean;
  className?: string;
};

export function StatusDropdown({
  status,
  options,
  onChange,
  disabled = false,
  className,
}: StatusDropdownProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button variant="secondary" className={className}>
          {options[status]}
          <ChevronDownIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuRadioGroup
          value={status}
          onValueChange={(next) => onChange(next as BookStatus)}
        >
          {BOOK_STATUS_ORDER.map((value) => (
            <DropdownMenuRadioItem key={value} value={value}>
              {options[value]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
