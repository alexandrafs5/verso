'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BellIcon, SearchIcon } from '@/components/ui/icons';
import { TopBarSearch } from '@/features/search/TopBarSearch';
import { cn } from '@/lib/utils';
import { AvatarMenu } from './AvatarMenu';
import { focusRing, isActive, topNavItems } from './nav';
import type { ShellUser } from './types';

type TopBarProps = {
  user: ShellUser;
  onSignOut(): void;
};

const iconButton = cn(
  'inline-flex size-11 items-center justify-center rounded-(--radius-button) text-foreground hover:bg-surface',
  focusRing,
);

export function TopBar({ user, onSignOut }: TopBarProps) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-6 px-4">
        <Link
          href="/home"
          className={cn(
            'rounded-(--radius-chip) font-serif text-2xl leading-none text-foreground',
            focusRing,
          )}
        >
          {t('wordmark')}
        </Link>
        <nav aria-label={t('mainNav')} className="hidden h-full md:block">
          <ul className="flex h-full items-stretch gap-6">
            {topNavItems.map(({ key, href }) => {
              const active = isActive(pathname, href);
              return (
                <li key={key} className="flex">
                  <Link
                    href={href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex items-center text-sm',
                      active ? 'font-medium text-foreground' : 'text-muted hover:text-foreground',
                      active &&
                        'after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-brass',
                      focusRing,
                    )}
                  >
                    {t(key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          {/* Below 768px the icon opens the search page; from 768px the field has a dropdown. */}
          <Link href="/search" aria-label={t('search')} className={cn(iconButton, 'md:hidden')}>
            <SearchIcon width={20} height={20} />
          </Link>
          <TopBarSearch className="hidden md:block" />
          <button type="button" aria-label={t('notifications')} className={iconButton}>
            <BellIcon width={20} height={20} />
          </button>
          <div className="hidden md:block">
            <AvatarMenu user={user} onSignOut={onSignOut} />
          </div>
        </div>
      </div>
    </header>
  );
}
