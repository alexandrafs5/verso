'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect } from 'react';
import { ErrorState } from '@/components/verso/ErrorState';
import { useMe } from '@/features/me/use-me';
import { ApiError } from '@/lib/api-client';
import { OnboardingLoading } from './OnboardingLoading';
import { firstIncompleteStep, stepPath } from './steps';

/**
 * Gate for the signed-in app: an account that has not finished onboarding is sent to its first
 * incomplete step. The rule reads only `onboardingCompletedAt`, so it cannot loop with the
 * opposite rule in OnboardingFlow.
 */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: me, error, refetch } = useMe();

  const signedOut = error instanceof ApiError && error.status === 401;
  const incomplete = Boolean(me) && !me?.onboardingCompletedAt;

  useEffect(() => {
    if (signedOut) router.replace('/sign-in');
    else if (me && incomplete) router.replace(stepPath(firstIncompleteStep(me)));
  }, [signedOut, incomplete, me, router]);

  if (error && !signedOut) {
    return (
      <div className="min-h-dvh bg-background py-12 text-foreground">
        <ErrorState
          heading={t('loadFailedTitle')}
          description={t('loadFailedBody')}
          retryLabel={tCommon('retry')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!me || signedOut || incomplete) return <OnboardingLoading />;
  return <>{children}</>;
}
