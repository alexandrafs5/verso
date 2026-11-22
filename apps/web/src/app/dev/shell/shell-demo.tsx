'use client';

// Dev demo: shell labels come from the i18n catalogs; demo copy stays hardcoded English.

import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useId, useState, useTransition } from 'react';
import { LOCALES } from '@verso/i18n';
import { AppShell } from '@/components/shell/AppShell';
import type { ShellUser } from '@/components/shell/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { setLocale } from '@/i18n/actions';
import { markWaking } from '@/lib/waking-state';

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-center gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
      <label htmlFor={id} className="text-sm">
        {label}
      </label>
    </div>
  );
}

export function ShellDemo() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [pending, startTransition] = useTransition();
  const [admin, setAdmin] = useState(false);
  const [waking, setWaking] = useState(false);
  const [signedOut, setSignedOut] = useState(0);

  useEffect(() => {
    if (!waking) return;
    return markWaking();
  }, [waking]);

  const user: ShellUser = {
    name: 'Ada Lovelace',
    username: 'ada',
    avatarUrl: null,
    role: admin ? 'ADMIN' : 'USER',
  };

  return (
    <AppShell user={user} onSignOut={() => setSignedOut((n) => n + 1)}>
      <div className="flex flex-col gap-6">
        <h1>App shell demo</h1>
        <p className="text-muted">
          Fake user, no auth. Nav links point at pages that arrive in later milestones and may 404.
        </p>
        <div className="flex flex-col gap-4">
          <ToggleRow label="Admin role" checked={admin} onChange={setAdmin} />
          <ToggleRow label="Simulate waking server" checked={waking} onChange={setWaking} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {t('common.theme')}
          </Button>
          <div role="group" aria-label={t('common.language')} className="flex gap-2">
            {LOCALES.map((l) => (
              <Button
                key={l}
                variant={l === locale ? 'primary' : 'secondary'}
                disabled={pending}
                aria-pressed={l === locale}
                onClick={() =>
                  startTransition(async () => {
                    await setLocale(l);
                    router.refresh();
                  })
                }
              >
                {t(`locale.${l}`)}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-sm text-muted" role="status">
          Sign out calls: {signedOut}
        </p>
        {Array.from({ length: 24 }, (_, i) => (
          <p key={i} className="text-muted">
            Filler paragraph {i + 1}: scroll to check the sticky top bar and that the last line
            clears the bottom tab bar on mobile.
          </p>
        ))}
      </div>
    </AppShell>
  );
}
