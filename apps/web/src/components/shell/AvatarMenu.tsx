'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SettingsIcon, SignOutIcon, UserIcon } from '@/components/ui/icons';
import type { ShellUser } from './types';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

type AvatarMenuProps = {
  user: ShellUser;
  onSignOut(): void;
};

export function AvatarMenu({ user, onSignOut }: AvatarMenuProps) {
  const t = useTranslations('shell');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('userMenu')}
        className="inline-flex size-11 items-center justify-center rounded-(--radius-round) outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            className="size-9 rounded-(--radius-round) border border-border object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex size-9 items-center justify-center rounded-(--radius-round) bg-accent text-sm font-medium text-on-accent"
          >
            {initialsOf(user.name)}
          </span>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/u/${user.username}`}>
            <UserIcon />
            {t('profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon />
            {t('settings')}
          </Link>
        </DropdownMenuItem>
        {user.role === 'ADMIN' && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <UserIcon />
              {t('admin')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onSignOut}>
          <SignOutIcon />
          {t('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
