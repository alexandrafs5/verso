import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Shown while the account loads and while a redirect is about to happen, so nothing flashes.
 * It mirrors OnboardingShell (header, heading, body, footer row) so the real step does not
 * make the page jump.
 */
export function OnboardingLoading() {
  const t = useTranslations('onboarding');
  return (
    <div
      role="status"
      aria-busy="true"
      className="flex min-h-dvh flex-col bg-background text-foreground"
    >
      <span className="sr-only">{t('loading')}</span>
      <header className="mx-auto w-full max-w-[560px] px-4 pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <Skeleton className="h-7 w-16" />
          <Skeleton className="h-5 w-24" />
        </div>
        <Skeleton className="h-[3px] w-full rounded-none" />
      </header>
      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 py-8">
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="mt-2 mb-8 h-5 w-2/3" />
        <div className="flex flex-1 flex-col gap-3">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
        <div className="mt-8 flex items-center justify-between gap-3">
          <Skeleton className="h-11 w-20" />
          <Skeleton className="h-11 w-28" />
        </div>
      </div>
    </div>
  );
}
