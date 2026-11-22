'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';
import { AUTH_QUOTES, pickQuote, type AuthQuote as Quote } from './quotes';

// The server and the hydration pass render the first quote. After hydration the client
// switches to a random one, chosen once per page load, so there is no hydration mismatch.
let clientQuote: Quote | null = null;
const subscribe = () => () => {};
const getClientQuote = () => (clientQuote ??= pickQuote());
const getServerQuote = () => AUTH_QUOTES[0] as Quote;

export function AuthQuote({ className }: { className?: string }) {
  const t = useTranslations();
  const quote = useSyncExternalStore(subscribe, getClientQuote, getServerQuote);

  return (
    <aside
      aria-label={t('auth.quoteLabel')}
      className={cn(
        'flex flex-col justify-between gap-5 bg-(--tag-wine) px-6 py-5 text-(--cover-ink) md:p-14',
        className,
      )}
    >
      <Link
        href="/"
        className="w-fit rounded-(--radius-chip) font-serif text-2xl leading-none font-medium text-(--cover-ink) italic outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-(--cover-ink) md:text-3xl"
      >
        {t('shell.wordmark')}
      </Link>

      <figure className="m-0">
        <span aria-hidden="true" className="mb-8 hidden h-px w-12 bg-brass md:block" />
        <blockquote className="m-0 font-serif text-xl leading-snug font-medium text-balance italic md:text-5xl md:leading-[1.2]">
          {quote.text}
        </blockquote>
        <figcaption className="mt-3 text-xs tracking-[0.14em] text-(--cover-ink)/85 uppercase md:mt-8">
          {quote.author}
        </figcaption>
      </figure>

      <p className="m-0 hidden text-xs text-(--cover-ink)/80 md:block">{t('auth.newPassage')}</p>
    </aside>
  );
}
