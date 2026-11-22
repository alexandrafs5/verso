'use client';

import { useTranslations } from 'next-intl';
import { useWakingState } from '@/lib/waking-state';

export function WakingBanner() {
  const t = useTranslations('shell');
  const state = useWakingState();
  if (state !== 'waking') return null;
  return (
    <div
      role="status"
      className="border-b border-border bg-surface px-4 py-2 text-center text-sm text-muted"
    >
      {t('wakingUp')}
    </div>
  );
}
