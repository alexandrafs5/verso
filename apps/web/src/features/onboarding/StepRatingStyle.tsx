'use client';

import type { Me, RatingStyle } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { RatingInput } from '@/components/verso';
import { isStarStyle } from '@/components/verso/RatingDisplay';
import { ChoiceGroup } from './ChoiceGroup';
import { OnboardingShell, STEP_FORM_ID } from './OnboardingShell';
import { useSaveSettings } from './use-save-settings';

type Family = 'STARS' | 'DECIMAL_10' | 'HUNDRED';
type StarPrecision = Extract<RatingStyle, 'STARS_WHOLE' | 'STARS_HALF' | 'STARS_QUARTER'>;

const familyOf = (style: RatingStyle): Family => (isStarStyle(style) ? 'STARS' : (style as Family));

type StepRatingStyleProps = { me: Me; onBack: () => void; onNext: () => void };

// Step 3: three styles; stars open a precision choice. The preview is the real RatingInput.
export function StepRatingStyle({ me, onBack, onNext }: StepRatingStyleProps) {
  const t = useTranslations('onboarding');
  const tRating = useTranslations('rating');
  const [style, setStyle] = useState<RatingStyle>(me.settings.ratingStyle);
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const { save, pending, failed } = useSaveSettings(onNext);

  function pickFamily(family: Family) {
    setPreviewValue(null);
    if (family === 'STARS') setStyle(isStarStyle(style) ? style : 'STARS_HALF');
    else setStyle(family);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    save({ ratingStyle: style });
  }

  return (
    <OnboardingShell
      step={3}
      pending={pending}
      error={failed ? t('saveFailed') : null}
      onBack={onBack}
    >
      <form id={STEP_FORM_ID} onSubmit={onSubmit} className="flex flex-col gap-6">
        <ChoiceGroup<Family>
          label={t('rating.groupLabel')}
          value={familyOf(style)}
          onChange={pickFamily}
          disabled={pending}
          choices={[
            {
              value: 'STARS',
              title: t('rating.stars.title'),
              description: t('rating.stars.description'),
            },
            {
              value: 'DECIMAL_10',
              title: t('rating.decimal.title'),
              description: t('rating.decimal.description'),
            },
            {
              value: 'HUNDRED',
              title: t('rating.hundred.title'),
              description: t('rating.hundred.description'),
            },
          ]}
        />

        {isStarStyle(style) ? (
          <ChoiceGroup<StarPrecision>
            label={t('rating.precisionLabel')}
            value={style as StarPrecision}
            onChange={setStyle}
            disabled={pending}
            choices={[
              { value: 'STARS_WHOLE', title: t('rating.whole') },
              { value: 'STARS_HALF', title: t('rating.half') },
              { value: 'STARS_QUARTER', title: t('rating.quarter') },
            ]}
          />
        ) : null}

        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm font-medium">{t('rating.previewLabel')}</p>
          <RatingInput
            value={previewValue}
            style={style}
            onChange={setPreviewValue}
            labels={{
              clear: tRating('clear'),
              star: (n) => tRating('star', { count: n }),
              slider: tRating('slider'),
              field: tRating('field'),
            }}
          />
        </div>
      </form>
    </OnboardingShell>
  );
}
