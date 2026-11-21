import en from './messages/en.json';
import es from './messages/es.json';
import type { Locale } from './locales';

export * from './locales';

export type Messages = typeof en;

export const messages: Record<Locale, Messages> = { en, es };
