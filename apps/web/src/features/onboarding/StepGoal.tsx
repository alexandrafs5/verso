'use client';

import { useMutation } from '@tanstack/react-query';
import { type Me, goalSchema, upsertGoalSchema } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { type FormEvent, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useRestoreFocus } from '@/features/auth/use-restore-focus';
import { api } from '@/lib/api-client';
import { currentYearIn } from '@/lib/time-zone';
import { OnboardingShell, STEP_FORM_ID } from './OnboardingShell';

const FIELD_ID = 'onboarding-goal';

type StepGoalProps = { me: Me; onBack: () => void; onNext: () => void };

// Step 6 (optional): how many books to read this year. Left blank, Continue just moves on.
export function StepGoal({ me, onBack, onNext }: StepGoalProps) {
  const t = useTranslations('onboarding');
  const year = currentYearIn(me.settings.timeZone);
  const [value, setValue] = useState('');
  const [invalid, setInvalid] = useState(false);

  const save = useMutation({
    mutationFn: (targetBooks: number) =>
      api.put(`/api/v1/me/goals/${year}`, goalSchema, { targetBooks }),
    onSuccess: onNext,
  });

  // The field is disabled while saving; this puts focus back where it was afterwards.
  useRestoreFocus(save.isPending);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (value.trim() === '') {
      onNext();
      return;
    }
    const parsed = upsertGoalSchema.safeParse({ targetBooks: Number(value) });
    if (!parsed.success) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    save.mutate(parsed.data.targetBooks);
  }

  return (
    <OnboardingShell
      step={6}
      pending={save.isPending}
      error={save.isError ? t('saveFailed') : null}
      onBack={onBack}
      onSkip={onNext}
    >
      <form id={STEP_FORM_ID} noValidate onSubmit={onSubmit} className="flex flex-col gap-1.5">
        <label htmlFor={FIELD_ID} className="text-sm font-medium">
          {t('goal.label', { year })}
        </label>
        <Input
          id={FIELD_ID}
          type="number"
          inputMode="numeric"
          min={1}
          max={999}
          step={1}
          value={value}
          disabled={save.isPending}
          aria-invalid={invalid || undefined}
          aria-describedby={`${FIELD_ID}-hint`}
          onChange={(event) => {
            setValue(event.target.value);
            setInvalid(false);
          }}
          className="max-w-40"
        />
        <p
          id={`${FIELD_ID}-hint`}
          className={`m-0 text-sm ${invalid ? 'text-danger' : 'text-muted'}`}
        >
          {invalid ? t('goal.invalid') : t('goal.hint')}
        </p>
      </form>
    </OnboardingShell>
  );
}
