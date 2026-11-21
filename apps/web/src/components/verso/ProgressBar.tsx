import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

type ProgressBarProps = {
  /** Basis points, 0-10000. Out-of-range values are clamped. */
  valueBp: number;
  /** Accessible name, supplied by the caller (translated). */
  label?: string;
  loading?: boolean;
  className?: string;
};

const MAX_BP = 10000;

function clampBp(valueBp: number): number {
  if (!Number.isFinite(valueBp)) return 0;
  return Math.min(MAX_BP, Math.max(0, valueBp));
}

export function ProgressBar({ valueBp, label, loading = false, className }: ProgressBarProps) {
  if (loading) {
    return <Skeleton className={cn('h-[3px] w-full rounded-none', className)} />;
  }

  const bp = clampBp(valueBp);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={bp / 100}
      className={cn('h-[3px] w-full overflow-hidden bg-border', className)}
    >
      <div
        className="h-full bg-brass transition-[width] duration-(--duration-slow) ease-(--ease-out)"
        style={{ width: `${bp / 100}%` }}
      />
    </div>
  );
}
