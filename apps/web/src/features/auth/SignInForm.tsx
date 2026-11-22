'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signInSchema, type SignInInput } from '@verso/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signIn } from '@/lib/auth-client';
import { AuthAlert, AuthField, OrDivider, fieldA11y, linkClass } from './AuthFormParts';
import { GoogleButton } from './GoogleButton';
import { mapAuthError, type AuthErrorKind } from './map-auth-error';
import { PasswordField } from './PasswordField';
import { SIGNED_IN_HOME, useRedirectIfSignedIn } from './use-redirect-if-signed-in';
import { useWakeUpPing } from './use-wake-up-ping';
import { validationKey } from './validation-messages';
import { withWaking } from './with-waking';

type Failure = Exclude<AuthErrorKind, 'unverified'> | 'google';

export function SignInForm({ oauthFailed = false }: { oauthFailed?: boolean }) {
  const t = useTranslations('auth');
  const router = useRouter();
  useWakeUpPing();
  useRedirectIfSignedIn();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signInSchema>, unknown, SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  const [failure, setFailure] = useState<Failure | null>(oauthFailed ? 'google' : null);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  function applyError(error: unknown, email: string) {
    const kind = mapAuthError(error);
    if (kind === 'unverified') {
      // The API re-sends the verification email on this response (SPEC 08).
      setUnverifiedEmail(email);
    } else {
      setFailure(kind);
    }
  }

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFailure(null);
    setUnverifiedEmail(null);
    try {
      const { error } = await withWaking(() =>
        signIn.email({ email, password, callbackURL: SIGNED_IN_HOME }),
      );
      if (error) {
        applyError(error, email);
        return;
      }
      router.replace(SIGNED_IN_HOME);
    } catch (error) {
      applyError(error, email);
    }
  });

  const emailKey = validationKey('email', errors.email?.type, getValues('email'));
  const passwordKey = validationKey('password', errors.password?.type, getValues('password'));

  return (
    <>
      <h1>{t('signIn.title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('signIn.subtitle')}</p>

      {failure ? <AuthAlert tone="error">{t(`errors.${failure}`)}</AuthAlert> : null}
      {unverifiedEmail ? (
        <AuthAlert tone="info" title={t('signIn.unverifiedTitle')}>
          {t('signIn.unverifiedBody', { email: unverifiedEmail })}
        </AuthAlert>
      ) : null}

      <div className="flex flex-col gap-5">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <AuthField
            id="sign-in-email"
            label={t('fields.email')}
            error={emailKey && t(`validation.${emailKey}`)}
          >
            <Input
              {...fieldA11y('sign-in-email', Boolean(emailKey))}
              type="email"
              autoComplete="email"
              disabled={isSubmitting}
              {...register('email')}
            />
          </AuthField>

          <AuthField
            id="sign-in-password"
            label={t('fields.password')}
            error={passwordKey && t(`validation.${passwordKey}`)}
            labelAction={
              <Link href="/forgot-password" className={`text-sm ${linkClass}`}>
                {t('signIn.forgot')}
              </Link>
            }
          >
            <PasswordField
              {...fieldA11y('sign-in-password', Boolean(passwordKey))}
              autoComplete="current-password"
              disabled={isSubmitting}
              {...register('password')}
            />
          </AuthField>

          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="mt-1">
            {isSubmitting ? t('signIn.submitting') : t('signIn.submit')}
          </Button>
        </form>

        <OrDivider label={t('orDivider')} />

        <GoogleButton
          disabled={isSubmitting}
          onStart={() => setFailure(null)}
          onError={() => setFailure('google')}
        />
      </div>

      <p className="mt-7 text-sm text-muted">
        {t('signIn.noAccount')}{' '}
        <Link href="/sign-up" className={linkClass}>
          {t('signIn.createLink')}
        </Link>
      </p>
    </>
  );
}
