'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { resetPasswordSchema, type ResetPasswordInput } from '@verso/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { AuthAlert, AuthField, fieldA11y, linkClass } from './AuthFormParts';
import { mapAuthError } from './map-auth-error';
import { PasswordField } from './PasswordField';
import { PasswordStrength } from './PasswordStrength';
import { useWakeUpPing } from './use-wake-up-ping';
import { validationKey } from './validation-messages';
import { withWaking } from './with-waking';

type Failure = 'rateLimited' | 'network' | 'generic';

export function ResetExpired() {
  const t = useTranslations('auth');
  return (
    <div>
      <span aria-hidden="true" className="mb-7 block h-px w-10 bg-brass" />
      <h1>{t('resetPassword.expiredTitle')}</h1>
      <p className="mt-3 mb-8 text-muted">{t('resetPassword.expiredBody')}</p>
      <Button asChild className="w-full">
        <Link href="/forgot-password">{t('resetPassword.requestNew')}</Link>
      </Button>
    </div>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  useWakeUpPing();

  const {
    register,
    handleSubmit,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof resetPasswordSchema>, unknown, ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const [failure, setFailure] = useState<Failure | null>(null);
  const [expired, setExpired] = useState(false);

  const password = watch('password');

  function applyError(error: unknown) {
    const status = (error as { status?: unknown } | null)?.status;
    const code = (error as { code?: unknown } | null)?.code;
    // A bad or used token comes back as 400 INVALID_TOKEN.
    if (code === 'INVALID_TOKEN' || status === 400) {
      setExpired(true);
      return;
    }
    const kind = mapAuthError(error);
    setFailure(kind === 'rateLimited' || kind === 'network' ? kind : 'generic');
  }

  const onSubmit = handleSubmit(async ({ password }) => {
    setFailure(null);
    try {
      const { error } = await withWaking(() =>
        authClient.resetPassword({ newPassword: password, token }),
      );
      if (error) {
        applyError(error);
        return;
      }
      router.replace('/sign-in?reset=success');
    } catch (error) {
      applyError(error);
    }
  });

  if (expired) return <ResetExpired />;

  const passwordKey = validationKey('password', errors.password?.type, getValues('password'));
  const confirmKey = validationKey(
    'confirmPassword',
    errors.confirmPassword?.type,
    getValues('confirmPassword'),
  );

  return (
    <>
      <h1>{t('resetPassword.title')}</h1>
      <p className="mt-2 mb-8 text-muted">{t('resetPassword.subtitle')}</p>

      {failure ? <AuthAlert tone="error">{t(`errors.${failure}`)}</AuthAlert> : null}

      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
        <AuthField
          id="reset-password"
          label={t('resetPassword.newPassword')}
          error={passwordKey && t(`validation.${passwordKey}`)}
        >
          <PasswordField
            {...fieldA11y('reset-password', Boolean(passwordKey))}
            // The strength hint is always described; the error joins it when present.
            aria-describedby={
              passwordKey
                ? 'reset-password-strength reset-password-error'
                : 'reset-password-strength'
            }
            autoComplete="new-password"
            disabled={isSubmitting}
            {...register('password')}
          />
          <PasswordStrength id="reset-password-strength" password={password ?? ''} />
        </AuthField>

        <AuthField
          id="reset-confirm"
          label={t('resetPassword.confirmPassword')}
          error={confirmKey && t(`validation.${confirmKey}`)}
        >
          <PasswordField
            {...fieldA11y('reset-confirm', Boolean(confirmKey))}
            autoComplete="new-password"
            disabled={isSubmitting}
            {...register('confirmPassword')}
          />
        </AuthField>

        <Button type="submit" disabled={isSubmitting} aria-busy={isSubmitting} className="mt-1">
          {isSubmitting ? t('resetPassword.submitting') : t('resetPassword.submit')}
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
