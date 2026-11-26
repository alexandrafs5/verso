import { cn } from '@/lib/utils';

type StatusBadgeProps = {
  /** Translated status name. */
  label: string;
  /** Times read, shown after the status. Both texts are supplied by the caller. */
  count?: { short: string; accessible: string };
  className?: string;
};

/**
 * The status of a book in the library, on a corner of its cover (DESIGN S5). Opaque, so it stays
 * legible on light and dark covers.
 */
export function StatusBadge({ label, count, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-x-1 rounded-(--radius-chip) border border-border bg-raised px-1.5 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
    >
      <span className="break-words">{label}</span>
      {count ? (
        <>
          <span aria-hidden="true">{count.short}</span>
          <span className="sr-only">{count.accessible}</span>
        </>
      ) : null}
    </span>
  );
}
