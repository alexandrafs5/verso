'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { AppShell } from '@/components/shell/AppShell';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/verso/EmptyState';
import { ErrorState } from '@/components/verso/ErrorState';
import { authClient, useSession } from '@/lib/auth-client';

// Placeholder until the real Home (M3 and later) and server-side route guards exist.
// It exists so sign-in has somewhere to land and proves the session check works.
export function HomePlaceholder() {
  const t = useTranslations();
  const router = useRouter();
  const { data, isPending, error, refetch } = useSession();
  const user = data?.user;

  useEffect(() => {
    if (!isPending && !error && !user) router.replace('/sign-in');
  }, [isPending, error, user, router]);

  async function handleSignOut() {
    try {
      await authClient.signOut();
    } finally {
      router.replace('/sign-in');
    }
  }

  if (error) {
    return (
      <div className="min-h-dvh bg-background py-12 text-foreground">
        <ErrorState
          heading={t('home.errorTitle')}
          description={t('auth.errors.network')}
          retryLabel={t('common.retry')}
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (!user) {
    // Pending, or about to redirect to /sign-in. Same skeleton for both, so nothing flashes.
    return (
      <div role="status" aria-busy="true" className="min-h-dvh bg-background text-foreground">
        <span className="sr-only">{t('home.checkingSession')}</span>
        <div className="border-b border-border">
          <div className="mx-auto flex h-14 max-w-[1200px] items-center px-4">
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 px-4 py-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-24 w-full max-w-md" />
        </div>
      </div>
    );
  }

  return (
    <AppShell
      user={{
        name: user.name,
        // Set in onboarding (M2.5). Until then there is no profile page to link to.
        username: user.username ?? '',
        avatarUrl: user.image ?? null,
        role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
      }}
      onSignOut={() => void handleSignOut()}
    >
      <h1>{t('home.title')}</h1>
      <EmptyState heading={t('home.emptyTitle')} description={t('home.emptyBody')} />
    </AppShell>
  );
}
