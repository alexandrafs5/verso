import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

/** Shown while the account loads and while a redirect is about to happen, so nothing flashes. */
export function OnboardingLoading() {
  const t = useTranslations('onboarding');
  return (
    <div role="status" aria-busy="true" className="min-h-dvh bg-background text-foreground">
      <span className="sr-only">{t('loading')}</span>
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6 px-4 pt-6">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
