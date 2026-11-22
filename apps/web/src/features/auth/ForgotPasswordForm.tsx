'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { emailOnlySchema, type EmailOnlyInput } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { authClient } from '@/lib/auth-client';
import { AuthAlert, AuthField, fieldA11y, linkClass } from './AuthFormParts';
import { mapAuthError } from './map-auth-error';
import { useWakeUpPing } from './use-wake-up-ping';
import { validationKey } from './validation-messages';
import { withWaking } from './with-waking';

type Failure = 'rateLimited' | 'network' | 'generic';

function failureOf(error: unknown): Failure | null {
  // An unknown address must look the same as a known one, so a not-found response is neutral.
  if ((error as { status?: unknown } | null)?.status === 404) return null;
  const kind = mapAuthError(error);
  return kind === 'rateLimited' || kind === 'network' ? kind : 'generic';
}

function Sent() {
  const t = useTranslations('auth');
  const heading = useRef<HTMLHeadingElement>(null);

  // Moves focus to the new content, so keyboard and screen reader users notice the change.
  useEffect(() => heading.current?.focus(), []);

  return (
    <div role="status">
      <span aria-hidden="true" className="mb-7 block h-px w-10 bg-brass" />
      <h1 ref={heading} tabIndex={-1} className="outline-none">
        {t('forgotPassword.sentTitle')}
      </h1>
      <p className="mt-3 text-muted">{t('forgotPassword.sentBody')}</p>
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className={linkClass}>
          {t('forgotPassword.backToSignIn')}
        </Link>
      </p>
    </div>
  );
}

export function ForgotPasswordForm() {
  const t = useTranslations('auth');
  useWakeUpPing();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof emailOnlySchema>, unknown, EmailOnlyInput>({
    resolver: zodResolver(emailOnlySchema),
    defaultValues: { email: '' },
  });

  const [failure, setFailure] = useState<Failure | null>(null);
  const [sent, setSent] = useState(false);

  const onSubmit = handleSubmit(async ({ email }) => {
    setFailure(null);
    try {
      const { error } = await withWaking(() =>
        authClient.requestPasswordReset({ email, redirectTo: '/reset-password' }),
      );
      if (error) {
        const next = failureOf(error);
        if (next) {
          setFailure(next);
          return;
        }
      }
      setSent(true);
    } catch (error) {
      setFailure(failureOf(error) ?? 'generic');
    }
  });

  if (sent) return <Sent />;

  const emailKey = validationKey('email', errors.email?.type, getValues('email'));

  return (
    <>
      <h1>{t('forgotPassword.title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('forgotPassword.subtitle')}</p>

      {failure ? <AuthAlert tone="error">{t(`errors.${failure}`)}</AuthAlert> : null}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <AuthField
          id="forgot-email"
          label={t('fields.email')}
          error={emailKey && t(`validation.${emailKey}`)}
        >
          <Input
            {...fieldA11y('forgot-email', Boolean(emailKey))}
            type="email"
            autoComplete="email"
            disabled={isSubmitting}
            {...register('email')}
          />
        </AuthField>

        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="mt-1">
          {isSubmitting ? t('forgotPassword.submitting') : t('forgotPassword.submit')}
        </Button>
      </form>

      <p className="mt-7 text-sm">
        <Link href="/sign-in" className={linkClass}>
          {t('forgotPassword.backToSignIn')}
        </Link>
      </p>
    </>
  );
}
