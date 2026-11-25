'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { ArrowLeftIcon } from '@/components/ui/icons';
import { cn } from '@/lib/utils';

type BackButtonProps = {
  /** Where to go when there is no history to go back to (a page opened in a new tab). */
  fallbackHref?: string;
  className?: string;
};

/** Goes back in the browser history, or to `fallbackHref` when this page is the first entry. */
export function BackButton({ fallbackHref = '/home', className }: BackButtonProps) {
  const t = useTranslations('common');
  const router = useRouter();

  return (
    <Button
      variant="ghost"
      size="sm"
      // Pull the label to the content edge: the ghost button has its own padding.
      className={cn('-ml-3', className)}
      onClick={() => {
        if (window.history.length > 1) router.back();
        else router.push(fallbackHref);
      }}
    >
      <ArrowLeftIcon />
      {t('back')}
    </Button>
  );
}
