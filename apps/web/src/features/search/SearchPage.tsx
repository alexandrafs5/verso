'use client';

import { GENRE_MAX, SEARCH_QUERY_MAX } from '@verso/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { XIcon, SearchIcon } from '@/components/ui/icons';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/verso';
import { focusRing } from '@/components/shell/nav';
import { cn } from '@/lib/utils';
import { searchHref } from './search-href';
import { SearchResultsList } from './SearchResultsList';
import { useRecentSearches } from './use-recent-searches';

/** Text from the URL that is usable as a query, or null. */
function validQuery(raw: string | null, max: number): string | null {
  const value = raw?.trim() ?? '';
  return value.length >= 1 && value.length <= max ? value : null;
}

export function SearchPage() {
  const t = useTranslations('search');
  const router = useRouter();
  const params = useSearchParams();
  const { add } = useRecentSearches();
  const inputRef = useRef<HTMLInputElement>(null);

  const rawQ = params.get('q') ?? '';
  const q = validQuery(rawQ, SEARCH_QUERY_MAX);
  const genre = validQuery(params.get('genre'), GENRE_MAX) ?? undefined;

  const [text, setText] = useState(rawQ);
  // Keep the field in step with the URL (back button, quick-results Enter).
  useEffect(() => setText(rawQ), [rawQ]);
  useEffect(() => {
    if (!q) inputRef.current?.focus();
  }, [q]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = text.trim();
    if (!next) return;
    add(next);
    router.push(searchHref(next, genre));
  }

  return (
    <div className="mx-auto max-w-3xl">
      <form role="search" aria-label={t('label')} onSubmit={onSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <SearchIcon
            width={18}
            height={18}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
          />
          <Input
            ref={inputRef}
            type="search"
            value={text}
            maxLength={SEARCH_QUERY_MAX}
            onChange={(event) => setText(event.target.value)}
            aria-label={t('label')}
            placeholder={t('placeholder')}
            className="pl-10"
          />
        </div>
        <Button type="submit">{t('submit')}</Button>
      </form>

      <h1 className="mt-8 font-serif text-2xl">{t('page.heading')}</h1>

      {genre ? (
        <div className="mt-3">
          <span className="inline-flex items-center gap-1 rounded-(--radius-chip) border border-border bg-surface py-1 pr-1 pl-3 text-sm">
            {t('page.genreChip', { genre })}
            <button
              type="button"
              aria-label={t('page.removeGenre', { genre })}
              onClick={() => router.push(q ? searchHref(q) : '/search')}
              className={cn(
                'inline-flex size-8 items-center justify-center rounded-(--radius-chip) text-muted hover:text-foreground',
                focusRing,
              )}
            >
              <XIcon width={14} height={14} />
            </button>
          </span>
        </div>
      ) : null}

      <div className="mt-4" aria-live="polite">
        {q ? (
          <SearchResultsList q={q} genre={genre} />
        ) : (
          <EmptyState heading={t('page.promptHeading')} description={t('page.promptBody')} />
        )}
      </div>
    </div>
  );
}
