import { cn } from '@/lib/utils';
import type { TagColor } from './types';

const DOT_BG: Record<TagColor, string> = {
  WINE: 'bg-(--tag-wine)',
  TOBACCO: 'bg-(--tag-tobacco)',
  BRASS: 'bg-(--tag-brass)',
  FOREST: 'bg-(--tag-forest)',
  NAVY: 'bg-(--tag-navy)',
  OXBLOOD: 'bg-(--tag-oxblood)',
  SLATE: 'bg-(--tag-slate)',
  SAND: 'bg-(--tag-sand)',
};

type TagChipProps = {
  name: string;
  color: TagColor;
  selected?: boolean;
  /** When set the chip is a toggle button; otherwise it is static. */
  onToggle?: () => void;
  className?: string;
};

// Colored dot + name. Text stays foreground so contrast holds in light and dark.
export function TagChip({ name, color, selected = false, onToggle, className }: TagChipProps) {
  const content = (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'size-2.5 shrink-0 rounded-(--radius-round) border border-muted/60',
          DOT_BG[color],
        )}
      />
      <span className="truncate">{name}</span>
    </>
  );

  const base = cn(
    'inline-flex max-w-full items-center gap-2 rounded-(--radius-chip) border px-2.5 text-sm text-foreground',
    selected ? 'border-accent bg-raised' : 'border-border bg-surface',
    className,
  );

  if (!onToggle) {
    return <span className={cn(base, 'min-h-7')}>{content}</span>;
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        base,
        'min-h-11 transition-colors duration-(--duration-fast) hover:bg-raised md:min-h-8',
      )}
    >
      {content}
    </button>
  );
}
