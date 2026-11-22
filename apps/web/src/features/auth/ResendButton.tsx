'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { AuthAlert } from './AuthFormParts';
import { VERIFY_EMAIL_CALLBACK } from './auth-routes';
import { mapAuthError } from './map-auth-error';
import { setPendingEmail } from './pending-email';
import { useResendCooldown } from './use-resend-cooldown';
import { withWaking } from './with-waking';

type Props = {
  /** A valid, normalized address, or null when the user has not typed one yet. */
  email: string | null;
  /** Called instead of sending when there is no valid address. */
  onMissingEmail: () => void;
};

type Failure = 'rateLimited' | 'network' | 'generic';

function toFailure(error: unknown): Failure {
  const kind = mapAuthError(error);
  return kind === 'rateLimited' || kind === 'network' ? kind : 'generic';
}

export function ResendButton({ email, onMissingEmail }: Props) {
  const t = useTranslations('auth');
  const { secondsLeft, start } = useResendCooldown();
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);

  async function resend() {
    if (!email) {
      onMissingEmail();
      return;
    }
    setFailure(null);
    setSent(false);
    setPending(true);
    try {
      const { error } = await withWaking(() =>
        authClient.sendVerificationEmail({ email, callbackURL: VERIFY_EMAIL_CALLBACK }),
      );
      if (error) {
        setFailure(toFailure(error));
        return;
      }
      setPendingEmail(email);
      start();
      setSent(true);
    } catch (error) {
      setFailure(toFailure(error));
    } finally {
      setPending(false);
    }
  }

  const cooling = secondsLeft > 0;
  const label = pending
    ? t('verifyEmail.resending')
    : cooling
      ? t('verifyEmail.resendIn', { seconds: secondsLeft })
      : t('verifyEmail.resend');

  return (
    <div>
      {failure ? <AuthAlert tone="error">{t(`errors.${failure}`)}</AuthAlert> : null}
      <Button
        type="button"
        variant="secondary"
        onClick={resend}
        disabled={pending || cooling}
        aria-busy={pending}
        className="w-full tabular-nums"
      >
        {label}
      </Button>
      {/* Announces the result without reading out every countdown tick. */}
      <p role="status" className={sent ? 'mt-3 text-sm text-muted' : 'sr-only'}>
        {sent ? t('verifyEmail.resent') : ''}
      </p>
    </div>
  );
}
