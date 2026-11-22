'use client';

import { emailOnlySchema } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthField, fieldA11y, linkClass } from './AuthFormParts';
import { getPendingEmail } from './pending-email';
import { ResendButton } from './ResendButton';

export type VerifyState = 'pending' | 'success' | 'expired';

export function VerifyEmailPanel({ state }: { state: VerifyState }) {
  const t = useTranslations('auth');

  if (state === 'success') {
    return (
      <div role="status">
        <span aria-hidden="true" className="mb-7 block h-px w-10 bg-brass" />
        <h1>{t('verifyEmail.successTitle')}</h1>
        <p className="mt-3 mb-8 text-muted">{t('verifyEmail.successBody')}</p>
        <Button asChild className="w-full">
          <Link href="/sign-in">{t('verifyEmail.successAction')}</Link>
        </Button>
      </div>
    );
  }

  return <ResendPanel state={state} />;
}

function ResendPanel({ state }: { state: 'pending' | 'expired' }) {
  const t = useTranslations('auth');
  // The address lives in sessionStorage only, so it is read after mount.
  const [ready, setReady] = useState(false);
  const [stored, setStored] = useState<string | null>(null);
  const [typed, setTyped] = useState('');
  const [typedInvalid, setTypedInvalid] = useState(false);

  useEffect(() => {
    setStored(getPendingEmail());
    setReady(true);
  }, []);

  const parsed = emailOnlySchema.safeParse({ email: typed });
  const email = stored ?? (parsed.success ? parsed.data.email : null);

  const title = state === 'expired' ? t('verifyEmail.expiredTitle') : t('verifyEmail.pendingTitle');
  const body =
    state === 'expired'
      ? t('verifyEmail.expiredBody')
      : stored
        ? t('verifyEmail.pendingBody', { email: stored })
        : t('verifyEmail.pendingBodyNoEmail');

  return (
    <div>
      <span aria-hidden="true" className="mb-7 block h-px w-10 bg-brass" />
      <h1>{title}</h1>

      {!ready ? (
        <Skeleton className="mt-3 mb-8 h-12 w-full" />
      ) : (
        <>
          <p className="mt-3 mb-8 text-muted">{body}</p>

          {stored === null ? (
            <div className="mb-5">
              <AuthField
                id="verify-email-address"
                label={t('fields.email')}
                error={
                  typedInvalid
                    ? t(
                        typed.trim() === ''
                          ? 'validation.emailRequired'
                          : 'validation.emailInvalid',
                      )
                    : undefined
                }
              >
                <Input
                  {...fieldA11y('verify-email-address', typedInvalid)}
                  type="email"
                  autoComplete="email"
                  value={typed}
                  onChange={(event) => {
                    setTyped(event.target.value);
                    setTypedInvalid(false);
                  }}
                />
              </AuthField>
            </div>
          ) : null}

          <ResendButton email={email} onMissingEmail={() => setTypedInvalid(true)} />
        </>
      )}

      <p className="mt-7 text-sm">
        <Link href="/sign-in" className={linkClass}>
          {t('verifyEmail.backToSignIn')}
        </Link>
      </p>
    </div>
  );
}
