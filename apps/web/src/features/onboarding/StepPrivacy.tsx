'use client';

import type { Me } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ChoiceGroup } from './ChoiceGroup';
import { OnboardingShell, STEP_FORM_ID } from './OnboardingShell';
import { useSaveSettings } from './use-save-settings';

type Visibility = Me['settings']['profileVisibility'];

type StepPrivacyProps = { me: Me; onBack: () => void; onNext: () => void };

// Step 5: public or private profile, each with one line on who sees what.
export function StepPrivacy({ me, onBack, onNext }: StepPrivacyProps) {
  const t = useTranslations('onboarding');
  const [visibility, setVisibility] = useState<Visibility>(me.settings.profileVisibility);
  const { save, pending, failed } = useSaveSettings(onNext);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save({ profileVisibility: visibility });
  }

  return (
    <OnboardingShell
      step={5}
      pending={pending}
      error={failed ? t('saveFailed') : null}
      onBack={onBack}
    >
      <form id={STEP_FORM_ID} onSubmit={onSubmit}>
        <ChoiceGroup<Visibility>
          label={t('privacy.groupLabel')}
          value={visibility}
          onChange={setVisibility}
          disabled={pending}
          choices={[
            {
              value: 'PUBLIC',
              title: t('privacy.public.title'),
              description: t('privacy.public.description'),
            },
            {
              value: 'PRIVATE',
              title: t('privacy.private.title'),
              description: t('privacy.private.description'),
            },
          ]}
        />
      </form>
    </OnboardingShell>
  );
}
