'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';
import { focusRing, isActive, tabItems } from './nav';

export function BottomTabBar({ username }: { username: string }) {
  const t = useTranslations('shell');
  const pathname = usePathname();
  return (
    <nav
      aria-label={t('tabBar')}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabItems(username).map(({ key, href, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={key}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs',
                  active ? 'font-medium text-accent-text' : 'text-muted',
                  focusRing,
                )}
              >
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute top-1 size-1 rounded-(--radius-round) bg-brass"
                  />
                )}
                <Icon width={22} height={22} />
                {t(key)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
