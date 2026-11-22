'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { OnboardingShell } from './OnboardingShell';

type StepImportProps = {
  pending: boolean;
  failed: boolean;
  onBack: () => void;
  /** Finishes onboarding. */
  onSkip: () => void;
};

// Step 7 (optional): the Goodreads import does not exist yet (M11), so this step explains it and
// offers only Skip. There is deliberately no import action. If finishing fails, the message
// comes with an explicit retry.
export function StepImport({ pending, failed, onBack, onSkip }: StepImportProps) {
  const t = useTranslations('onboarding');
  const tCommon = useTranslations('common');
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
        {failed ? (
          <div>
            <Button type="button" variant="secondary" disabled={pending} onClick={onSkip}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </OnboardingShell>
  );
}
