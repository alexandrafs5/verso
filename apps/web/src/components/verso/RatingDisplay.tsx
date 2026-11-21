import { StarIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';
import type { RatingStyle } from './types';

const STAR_COUNT = 5;
const POINTS_PER_STAR = 100 / STAR_COUNT;

type StarsProps = {
  /** 0-100 */
  value: number;
  /** Icon edge in px. */
  size?: number;
  className?: string;
};

// Decorative row of five stars; partial stars are clipped fills. Meaning is carried by the text beside it.
export function Stars({ value, size = 16, className }: StarsProps) {
  return (
    <span aria-hidden="true" className={cn('inline-flex text-muted', className)}>
      {Array.from({ length: STAR_COUNT }, (_, i) => {
        const fill = Math.min(1, Math.max(0, (value - i * POINTS_PER_STAR) / POINTS_PER_STAR));
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <StarIcon width={size} height={size} />
            {fill > 0 ? (
              <span
                className="absolute inset-y-0 left-0 overflow-hidden text-brass"
                style={{ width: `${fill * 100}%` }}
              >
                <StarIcon width={size} height={size} fill="currentColor" />
              </span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}

export function isStarStyle(style: RatingStyle): boolean {
  return style === 'STARS_WHOLE' || style === 'STARS_HALF' || style === 'STARS_QUARTER';
}

type RatingDisplayProps = {
  /** 0-100, or null when unrated. */
  value: number | null;
  style: RatingStyle;
  /** Already formatted by the caller (M1.4 owns formatting rules). */
  formatted: string;
  emptyLabel: string;
  className?: string;
};

export function RatingDisplay({
  value,
  style,
  formatted,
  emptyLabel,
  className,
}: RatingDisplayProps) {
  if (value === null) {
    return <span className={cn('text-muted text-sm', className)}>{emptyLabel}</span>;
  }

  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      {isStarStyle(style) ? <Stars value={value} /> : null}
      <span className="text-foreground text-sm tabular-nums">{formatted}</span>
    </span>
  );
}
