import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type ErrorStateProps = {
  /** What happened. */
  heading: string;
  /** What to do next. */
  description: string;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
};

export function ErrorState({
  heading,
  description,
  retryLabel,
  onRetry,
  className,
}: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center',
        className,
      )}
    >
      <h2 className="break-words">{heading}</h2>
      <p className="break-words text-muted">{description}</p>
      <Button variant="secondary" className="mt-2" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  );
}
