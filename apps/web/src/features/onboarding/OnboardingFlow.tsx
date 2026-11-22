'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ErrorState } from '@/components/verso/ErrorState';
import { useCompleteOnboarding, useMe } from '@/features/me/use-me';
import { ApiError } from '@/lib/api-client';
import { OnboardingLoading } from './OnboardingLoading';
import { OnboardingShell } from './OnboardingShell';
import { StepName } from './StepName';
import { StepPhoto } from './StepPhoto';
import { StepPrivacy } from './StepPrivacy';
import { StepProgressStyle } from './StepProgressStyle';
import { StepRatingStyle } from './StepRatingStyle';
import { TOTAL_STEPS, stepPath } from './steps';

type OnboardingFlowProps = { step: number };

export function OnboardingFlow({ step }: OnboardingFlowProps) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { data: me, error, refetch } = useMe();
  const complete = useCompleteOnboarding();

  const signedOut = error instanceof ApiError && error.status === 401;
  const alreadyDone = Boolean(me?.onboardingCompletedAt);
  // The username is the only required step: without it nothing past step 1 is reachable.
  const needsUsername = Boolean(me) && !me?.username && step !== 1;

  useEffect(() => {
    if (signedOut) router.replace('/sign-in');
    else if (alreadyDone) router.replace('/home');
    else if (needsUsername) router.replace(stepPath(1));
  }, [signedOut, alreadyDone, needsUsername, router]);

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

  if (!me || signedOut || alreadyDone || needsUsername) return <OnboardingLoading />;

  const goTo = (n: number) => router.push(stepPath(n));
  const next = () => goTo(Math.min(step + 1, TOTAL_STEPS));
  const back = () => goTo(Math.max(step - 1, 1));
  const finish = () => complete.mutate(undefined, { onSuccess: () => router.replace('/home') });

  switch (step) {
    case 1:
      return <StepName me={me} onNext={next} />;
    case 2:
      return <StepPhoto me={me} onBack={back} onNext={next} />;
    case 3:
      return <StepRatingStyle me={me} onBack={back} onNext={next} />;
    case 4:
      return <StepProgressStyle me={me} onBack={back} onNext={next} />;
    case 5:
      return <StepPrivacy me={me} onBack={back} onNext={next} />;
    default:
      // Steps 6 and 7 are optional. Their bodies arrive in a later plan step; until then only
      // the shell shows, with Skip, and skipping the last step finishes onboarding.
      return (
        <OnboardingShell
          step={step}
          showPrimary={false}
          pending={complete.isPending}
          error={complete.isError ? t('saveFailed') : null}
          onBack={back}
          onSkip={step === TOTAL_STEPS ? finish : next}
        />
      );
  }
}
