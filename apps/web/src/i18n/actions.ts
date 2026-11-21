'use server';

import { cookies } from 'next/headers';
import { LOCALE_COOKIE, isLocale } from '@verso/i18n';

// M2.5 will also persist the choice in the user's settings.
export async function setLocale(locale: string): Promise<void> {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
