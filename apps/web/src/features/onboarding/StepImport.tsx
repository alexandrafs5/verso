'use client';

import { useTranslations } from 'next-intl';
import { OnboardingShell } from './OnboardingShell';

type StepImportProps = {
  pending: boolean;
  failed: boolean;
  onBack: () => void;
  /** Finishes onboarding. */
  onSkip: () => void;
};

// Step 7 (optional): the Goodreads import does not exist yet (M11), so this step explains it and
// offers only Skip. There is deliberately no import action.
export function StepImport({ pending, failed, onBack, onSkip }: StepImportProps) {
  const t = useTranslations('onboarding');
  return (
    <OnboardingShell
      step={7}
      showPrimary={false}
      pending={pending}
      error={failed ? t('saveFailed') : null}
      onBack={onBack}
      onSkip={onSkip}
    >
      <div className="flex flex-col gap-3">
        <p className="m-0">{t('import.body')}</p>
        <p className="m-0 text-muted">{t('import.soon')}</p>
      </div>
    </OnboardingShell>
  );
}
