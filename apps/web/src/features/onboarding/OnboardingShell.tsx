'use client';

import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useRef } from 'react';
import { WakingBanner } from '@/components/shell/WakingBanner';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/verso';
import { AuthAlert } from '@/features/auth/AuthFormParts';
import { STEP_KEYS, TOTAL_STEPS, isOptionalStep } from './steps';

export const STEP_FORM_ID = 'onboarding-step-form';

type OnboardingShellProps = {
  step: number;
  /** Disables the controls while a request is in flight. */
  pending?: boolean;
  /** Inline problem message with the primary button as the retry. */
  error?: string | null;
  /** Hide the primary button on steps whose only action is Skip. */
  showPrimary?: boolean;
  /** Not used on step 1: there is nowhere to go back to. */
  onBack?: () => void;
  /** Only called on the optional steps (2, 6 and 7). */
  onSkip?: () => void;
  children?: ReactNode;
};

// One step per screen (DESIGN P3): thin progress bar, "Step N of 7", Back, Skip on optional steps.
export function OnboardingShell({
  step,
  pending = false,
  error = null,
  showPrimary = true,
  onBack,
  onSkip,
  children,
}: OnboardingShellProps) {
  const t = useTranslations('onboarding');
  const tShell = useTranslations('shell');
  const stepKey = STEP_KEYS[step - 1] as (typeof STEP_KEYS)[number];
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Focus follows the step: screen reader and keyboard users land on the new heading.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <WakingBanner />
      <header className="mx-auto w-full max-w-[560px] px-4 pt-6">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <span className="font-serif text-2xl leading-none">{tShell('wordmark')}</span>
          <span className="text-sm text-muted">
            {t('stepOf', { current: step, total: TOTAL_STEPS })}
          </span>
        </div>
        <ProgressBar valueBp={(step / TOTAL_STEPS) * 10000} label={t('progressLabel')} />
      </header>

      <main className="mx-auto flex w-full max-w-[560px] flex-1 flex-col px-4 py-8">
        <h1 ref={headingRef} tabIndex={-1} className="outline-none">
          {t(`steps.${stepKey}.title`)}
        </h1>
        <p className="mt-2 mb-8 text-muted">{t(`steps.${stepKey}.description`)}</p>

        <div className="flex-1">{children}</div>

        {error ? (
          <div className="mt-6">
            <AuthAlert tone="error">{error}</AuthAlert>
          </div>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3">
          <div>
            {step > 1 ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={onBack}>
                {t('back')}
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {isOptionalStep(step) ? (
              <Button type="button" variant="ghost" disabled={pending} onClick={onSkip}>
                {t('skip')}
              </Button>
            ) : null}
            {showPrimary ? (
              <Button type="submit" form={STEP_FORM_ID} disabled={pending} aria-busy={pending}>
                {pending ? t('saving') : t('continue')}
              </Button>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}
