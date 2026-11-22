'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { signUpSchema, type SignUpInput } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { signUp } from '@/lib/auth-client';
import { AuthAlert, AuthField, OrDivider, fieldA11y, linkClass } from './AuthFormParts';
import { GoogleButton } from './GoogleButton';
import { mapAuthError, type AuthErrorKind } from './map-auth-error';
import { PasswordField } from './PasswordField';
import { PasswordStrength } from './PasswordStrength';
import { useRedirectIfSignedIn } from './use-redirect-if-signed-in';
import { validationKey } from './validation-messages';
import { withWaking } from './with-waking';

type Failure = Exclude<AuthErrorKind, 'unverified' | 'invalidCredentials'> | 'google';

// SPEC 10 replaces this inline panel with a redirect to /verify-email.
function CheckInbox({ email }: { email: string }) {
  const t = useTranslations('auth');
  const heading = useRef<HTMLHeadingElement>(null);

  // Moves focus to the new content, so keyboard and screen reader users notice the change.
  useEffect(() => heading.current?.focus(), []);

  return (
    <div role="status">
      <span aria-hidden="true" className="mb-7 block h-px w-10 bg-brass" />
      <h1 ref={heading} tabIndex={-1} className="outline-none">
        {t('signUp.checkInboxTitle')}
      </h1>
      <p className="mt-3 text-muted">{t('signUp.checkInboxBody', { email })}</p>
      <p className="mt-6 text-sm">
        <Link href="/sign-in" className={linkClass}>
          {t('signUp.backToSignIn')}
        </Link>
      </p>
    </div>
  );
}

export function SignUpForm() {
  const t = useTranslations('auth');
  useRedirectIfSignedIn();

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof signUpSchema>, unknown, SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const [failure, setFailure] = useState<Failure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const password = watch('password');

  const onSubmit = handleSubmit(async ({ name, email, password }) => {
    setFailure(null);
    try {
      const { error } = await withWaking(() =>
        signUp.email({ name, email, password, callbackURL: '/sign-in' }),
      );
      if (error) {
        const kind = mapAuthError(error);
        // A sign-up never returns "wrong credentials"; treat any stray one as generic.
        setFailure(kind === 'unverified' || kind === 'invalidCredentials' ? 'generic' : kind);
        return;
      }
      setSentTo(email);
    } catch (error) {
      const kind = mapAuthError(error);
      setFailure(kind === 'unverified' || kind === 'invalidCredentials' ? 'generic' : kind);
    }
  });

  if (sentTo) return <CheckInbox email={sentTo} />;

  const nameKey = validationKey('name', errors.name?.type, getValues('name'));
  const emailKey = validationKey('email', errors.email?.type, getValues('email'));
  const passwordKey = validationKey('password', errors.password?.type, getValues('password'));

  return (
    <>
      <h1>{t('signUp.title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('signUp.subtitle')}</p>

      {failure ? (
        <AuthAlert tone="error">
          {t(`errors.${failure}`)}
          {failure === 'emailInUse' ? (
            <>
              {' '}
              <Link href="/sign-in" className={linkClass}>
                {t('signUp.signInLink')}
              </Link>
            </>
          ) : null}
        </AuthAlert>
      ) : null}

      <div className="flex flex-col gap-5">
        <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
          <AuthField
            id="sign-up-name"
            label={t('fields.name')}
            error={nameKey && t(`validation.${nameKey}`)}
          >
            <Input
              {...fieldA11y('sign-up-name', Boolean(nameKey))}
              type="text"
              autoComplete="name"
              disabled={isSubmitting}
              {...register('name')}
            />
          </AuthField>

          <AuthField
            id="sign-up-email"
            label={t('fields.email')}
            error={emailKey && t(`validation.${emailKey}`)}
          >
            <Input
              {...fieldA11y('sign-up-email', Boolean(emailKey))}
              type="email"
              autoComplete="email"
              disabled={isSubmitting}
              {...register('email')}
            />
          </AuthField>

          <AuthField
            id="sign-up-password"
            label={t('fields.password')}
            error={passwordKey && t(`validation.${passwordKey}`)}
          >
            <PasswordField
              {...fieldA11y('sign-up-password', Boolean(passwordKey))}
              // The strength hint is always described; the error joins it when present.
              aria-describedby={
                passwordKey
                  ? 'sign-up-password-strength sign-up-password-error'
                  : 'sign-up-password-strength'
              }
              autoComplete="new-password"
              disabled={isSubmitting}
              {...register('password')}
            />
            <PasswordStrength id="sign-up-password-strength" password={password ?? ''} />
          </AuthField>

          <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="mt-1">
            {isSubmitting ? t('signUp.submitting') : t('signUp.submit')}
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
        {t('signUp.hasAccount')}{' '}
        <Link href="/sign-in" className={linkClass}>
          {t('signUp.signInLink')}
        </Link>
      </p>
    </>
  );
}
