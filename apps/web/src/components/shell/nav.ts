import type { ComponentType, SVGProps } from 'react';
import { HomeIcon, LibraryIcon, SearchIcon, StatsIcon, UserIcon } from '@/components/ui/icons';

export type NavItem = {
  key: 'home' | 'library' | 'search' | 'stats' | 'profile';
  href: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export const focusRing =
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Active when the path equals the href or sits below it. */
export function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export const topNavItems: NavItem[] = [
  { key: 'home', href: '/home', Icon: HomeIcon },
  { key: 'library', href: '/library', Icon: LibraryIcon },
  { key: 'stats', href: '/stats', Icon: StatsIcon },
];

export function tabItems(username: string): NavItem[] {
  return [
    { key: 'home', href: '/home', Icon: HomeIcon },
    { key: 'library', href: '/library', Icon: LibraryIcon },
    { key: 'search', href: '/search', Icon: SearchIcon },
    { key: 'stats', href: '/stats', Icon: StatsIcon },
    { key: 'profile', href: `/u/${username}`, Icon: UserIcon },
  ];
}
