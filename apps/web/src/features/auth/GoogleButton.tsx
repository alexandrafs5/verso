'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { signIn } from '@/lib/auth-client';
import { SIGNED_IN_HOME } from './use-redirect-if-signed-in';

type GoogleButtonProps = {
  disabled?: boolean;
  /** Called when Google sign-in cannot start (for example, Google is not configured). */
  onError(): void;
  onStart?(): void;
};

export function GoogleButton({ disabled, onError, onStart }: GoogleButtonProps) {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);

  async function handleClick() {
    onStart?.();
    setPending(true);
    try {
      // On success the browser leaves for Google. A returned error means it could not start.
      const { error } = await signIn.social({
        provider: 'google',
        callbackURL: SIGNED_IN_HOME,
        errorCallbackURL: '/sign-in?error=oauth',
      });
      if (error) {
        setPending(false);
        onError();
      }
    } catch {
      setPending(false);
      onError();
    }
  }

  return (
    <Button
      type="button"
      variant="secondary"
      className="w-full"
      disabled={disabled || pending}
      onClick={handleClick}
    >
      {t('google')}
    </Button>
  );
}
