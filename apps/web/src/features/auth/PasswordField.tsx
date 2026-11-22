'use client';

import { useTranslations } from 'next-intl';
import { type ComponentProps, useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type PasswordFieldProps = Omit<ComponentProps<typeof Input>, 'type'>;

// The visible Show/Hide text is the label (no icon), and the aria-label gives the full action.
export function PasswordField({ className, id, ...props }: PasswordFieldProps) {
  const t = useTranslations('auth');
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        id={id}
        type={visible ? 'text' : 'password'}
        className={cn('pr-18', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? t('hidePassword') : t('showPassword')}
        aria-controls={id}
        aria-pressed={visible}
        disabled={props.disabled}
        className="absolute top-1 right-1 inline-flex h-9 items-center rounded-(--radius-button) px-3 text-sm text-muted outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-50 md:h-8"
      >
        {visible ? t('hide') : t('show')}
      </button>
    </div>
  );
}
