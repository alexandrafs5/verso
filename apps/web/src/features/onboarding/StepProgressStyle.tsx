'use client';

import type { Me } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { ProgressBar } from '@/components/verso';
import { ChoiceGroup } from './ChoiceGroup';
import { OnboardingShell, STEP_FORM_ID } from './OnboardingShell';
import { useSaveSettings } from './use-save-settings';

type Style = Me['settings']['progressStyle'];

type StepProgressStyleProps = { me: Me; onBack: () => void; onNext: () => void };

// Step 4: pages or percentage, each with a small progress-bar preview.
export function StepProgressStyle({ me, onBack, onNext }: StepProgressStyleProps) {
  const t = useTranslations('onboarding');
  const [style, setStyle] = useState<Style>(me.settings.progressStyle);
  const { save, pending, failed } = useSaveSettings(onNext);

  const preview = (text: string) => (
    <span className="flex flex-col gap-1.5">
      <ProgressBar valueBp={5000} label={`${t('progress.previewLabel')}: ${text}`} />
      <span className="text-sm text-muted">{text}</span>
    </span>
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save({ progressStyle: style });
  }

  return (
    <OnboardingShell
      step={4}
      pending={pending}
      error={failed ? t('saveFailed') : null}
      onBack={onBack}
    >
      <form id={STEP_FORM_ID} onSubmit={onSubmit}>
        <ChoiceGroup<Style>
          label={t('progress.groupLabel')}
          value={style}
          onChange={setStyle}
          disabled={pending}
          choices={[
            {
              value: 'PAGES',
              title: t('progress.pages.title'),
              description: t('progress.pages.description'),
              preview: preview(t('progress.pages.preview')),
            },
            {
              value: 'PERCENT',
              title: t('progress.percent.title'),
              description: t('progress.percent.description'),
              preview: preview(t('progress.percent.preview')),
            },
          ]}
        />
      </form>
    </OnboardingShell>
  );
}
