'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { type Me, USERNAME_UNAVAILABLE_REASONS } from '@verso/shared';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { AuthField, fieldA11y } from '@/features/auth/AuthFormParts';
import { useUpdateMe, useUpdateSettings } from '@/features/me/use-me';
import { ApiError } from '@/lib/api-client';
import { browserTimeZone } from '@/lib/time-zone';
import { OnboardingShell, STEP_FORM_ID } from './OnboardingShell';
import { useSuggestedUsername } from './use-suggested-username';
import { useUsernameAvailability } from './use-username-availability';

const formSchema = z.object({
  name: z.string().trim().min(1, 'nameRequired').max(80, 'nameTooLong'),
  username: z.string().trim().min(1, 'usernameRequired'),
});
type FormValues = z.infer<typeof formSchema>;
type FormErrorKey = 'nameRequired' | 'nameTooLong' | 'usernameRequired';
type Reason = (typeof USERNAME_UNAVAILABLE_REASONS)[number];

const isReason = (value: string): value is Reason =>
  (USERNAME_UNAVAILABLE_REASONS as readonly string[]).includes(value);

type StepNameProps = { me: Me; onNext: () => void };

const USERNAME_ID = 'onboarding-username';
const NAME_ID = 'onboarding-name';

// Step 1 (required): display name and @username with a live availability check. It also sends the
// browser time zone and the current UI locale, so no extra onboarding step is needed for them.
export function StepName({ me, onNext }: StepNameProps) {
  const t = useTranslations('onboarding');
  const locale = useLocale();
  const updateMe = useUpdateMe();
  const updateSettings = useUpdateSettings();

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    setValue,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: me.name, username: me.username ?? '' },
  });

  // A reason the server gave on save (taken, or rejected by the policy).
  const [serverReason, setServerReason] = useState<Reason | null>(null);
  const [failed, setFailed] = useState(false);

  const username = watch('username');
  const availability = useUsernameAvailability(username, me.username);

  useSuggestedUsername(me, (suggestion) => {
    // Only fill an empty field: never overwrite what the person already typed.
    if (!getValues('username')) setValue('username', suggestion);
  });

  const onSubmit = handleSubmit(async (values) => {
    setFailed(false);
    if (availability.kind === 'unavailable') {
      setFocus('username');
      return;
    }
    try {
      const timeZone = browserTimeZone();
      await updateSettings.mutateAsync({
        locale: locale === 'es' ? 'es' : 'en',
        ...(timeZone ? { timeZone } : {}),
      });
      await updateMe.mutateAsync({ name: values.name, username: values.username });
      onNext();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'USERNAME_TAKEN') {
        setServerReason('TAKEN');
        setFocus('username');
      } else if (
        error instanceof ApiError &&
        error.code === 'USERNAME_INVALID' &&
        error.problem?.detail &&
        isReason(error.problem.detail)
      ) {
        setServerReason(error.problem.detail);
        setFocus('username');
      } else {
        setFailed(true);
      }
    }
  });

  const nameError = errors.name?.message as FormErrorKey | undefined;
  const usernameError = errors.username?.message as FormErrorKey | undefined;

  const statusText = usernameError
    ? t(`name.errors.${usernameError}`)
    : serverReason
      ? t(`name.availability.${serverReason}`)
      : availability.kind === 'checking'
        ? t('name.availability.checking')
        : availability.kind === 'available'
          ? t('name.availability.available')
          : availability.kind === 'unavailable'
            ? t(`name.availability.${availability.reason}`)
            : availability.kind === 'error'
              ? t('name.availability.checkFailed')
              : null;
  const statusIsProblem =
    Boolean(usernameError || serverReason) || availability.kind === 'unavailable';

  return (
    <OnboardingShell
      step={1}
      pending={isSubmitting}
      error={failed ? t('saveFailed') : null}
    >
      <form id={STEP_FORM_ID} noValidate onSubmit={onSubmit} className="flex flex-col gap-6">
        <AuthField
          id={NAME_ID}
          label={t('name.nameLabel')}
          error={nameError ? t(`name.errors.${nameError}`) : undefined}
        >
          <Input
            {...fieldA11y(NAME_ID, Boolean(nameError))}
            type="text"
            autoComplete="name"
            disabled={isSubmitting}
            {...register('name')}
          />
        </AuthField>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={USERNAME_ID} className="text-sm font-medium">
            {t('name.usernameLabel')}
          </label>
          <div className="relative">
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
            >
              @
            </span>
            <Input
              id={USERNAME_ID}
              className="pl-7"
              type="text"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              disabled={isSubmitting}
              aria-invalid={statusIsProblem || undefined}
              aria-describedby={`${USERNAME_ID}-hint ${USERNAME_ID}-status`}
              {...register('username', { onChange: () => setServerReason(null) })}
            />
          </div>
          <p id={`${USERNAME_ID}-hint`} className="m-0 text-sm text-muted">
            {t('name.usernameHint')}
          </p>
          {/* Polite live region: the result is announced without stealing focus. */}
          <p
            id={`${USERNAME_ID}-status`}
            aria-live="polite"
            className={`m-0 min-h-5 text-sm ${statusIsProblem ? 'text-danger' : 'text-muted'}`}
          >
            {statusText}
          </p>
        </div>
      </form>
    </OnboardingShell>
  );
}
