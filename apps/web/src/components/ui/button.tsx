import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap',
    'rounded-(--radius-button) font-medium text-sm transition-colors duration-(--duration-fast)',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:pointer-events-none [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent hover:bg-accent/90',
        secondary: 'border border-border bg-surface text-foreground hover:bg-raised',
        ghost: 'text-foreground hover:bg-surface',
        destructive: 'bg-danger text-on-danger hover:bg-danger/90',
        link: 'text-accent-text underline-offset-4 hover:underline',
      },
      // Touch targets are >= 44px on mobile; compact on pointer-first widths.
      size: {
        default: 'h-11 px-4 md:h-10',
        sm: 'h-11 px-3 md:h-8',
        lg: 'h-12 px-6',
        icon: 'size-11 md:size-10',
      },
    },
    defaultVariants: { variant: 'primary', size: 'default' },
  },
);

type ButtonProps = ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : 'button';
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
