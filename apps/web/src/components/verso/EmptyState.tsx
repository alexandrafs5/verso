import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  heading: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
};

// Text only, no illustration (DESIGN.md).
export function EmptyState({ heading, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-12 text-center',
        className,
      )}
    >
      <h2 className="break-words">{heading}</h2>
      <p className="break-words text-muted">{description}</p>
      {action ? (
        <Button className="mt-2" onClick={action.onClick}>
          {action.label}
        </Button>
      ) : null}
    </div>
  );
}
