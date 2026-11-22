'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { ErrorState } from '@/components/verso/ErrorState';
import { useCompleteOnboarding, useMe } from '@/features/me/use-me';
import { ApiError } from '@/lib/api-client';
import { OnboardingLoading } from './OnboardingLoading';
import { StepGoal } from './StepGoal';
import { StepImport } from './StepImport';
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
    case 6:
      return <StepGoal me={me} onBack={back} onNext={next} />;
    default:
      // Step 7 is the last one: skipping it finishes onboarding.
      return (
        <StepImport
          pending={complete.isPending}
          failed={complete.isError}
          onBack={back}
          onSkip={finish}
        />
      );
  }
}
