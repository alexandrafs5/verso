'use client';

import { SEARCH_QUERY_MAX } from '@verso/shared';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useId, useMemo, useRef, useState } from 'react';
import { SearchIcon } from '@/components/ui/icons';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';
import { type QuickOption, QuickResults, type QuickStatus } from './QuickResults';
import { RecentSearches } from './RecentSearches';
import { searchHref } from './search-href';
import { useRecentSearches } from './use-recent-searches';
import { useSearchShortcut } from './use-search-shortcut';
import { useSearchBooks } from './use-search-books';
import { workHref } from './SearchResultRow';

export const QUICK_DEBOUNCE_MS = 250;
export const QUICK_MIN_LENGTH = 2;
export const QUICK_MAX_RESULTS = 5;

export function TopBarSearch({ className }: { className?: string }) {
  const t = useTranslations('search');
  const router = useRouter();
  const rootId = useId();
  const listId = `${rootId}-list`;
  const optionId = (index: number) => `${rootId}-opt-${index}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const recents = useRecentSearches();

  const trimmed = text.trim();
  const searching = trimmed.length >= QUICK_MIN_LENGTH;
  const debounced = useDebouncedValue(trimmed, QUICK_DEBOUNCE_MS);
  const query = useSearchBooks({
    q: debounced,
    minLength: QUICK_MIN_LENGTH,
    keepPrevious: true,
  });

  const works = useMemo(
    () => (query.data?.pages[0]?.items ?? []).slice(0, QUICK_MAX_RESULTS),
    [query.data],
  );

  let status: QuickStatus = 'ready';
  if (searching) {
    if (query.isError && !query.data) status = 'error';
    else if (!query.data) status = 'loading';
    else if (works.length === 0 && !query.isFetching && debounced === trimmed) status = 'empty';
  }

  const options: QuickOption[] = searching
    ? [...works.map((work): QuickOption => ({ kind: 'work', work })), { kind: 'all' }]
    : recents.items.map((item): QuickOption => ({ kind: 'recent', text: item }));
  const showPanel = open && (searching || recents.items.length > 0);
  const active = activeIndex >= 0 && activeIndex < options.length ? activeIndex : -1;

  useSearchShortcut(
    () => {
      inputRef.current?.focus();
      inputRef.current?.select();
      setOpen(true);
    },
    () => document.activeElement === inputRef.current,
  );

  function close() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function go(q: string) {
    recents.add(q);
    close();
    router.push(searchHref(q));
  }

  function activate(option: QuickOption) {
    if (option.kind === 'work') {
      close();
      router.push(workHref(option.work.ref));
    } else if (option.kind === 'recent') {
      setText(option.text);
      go(option.text);
    } else if (trimmed) {
      go(trimmed);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (options.length === 0) return;
      event.preventDefault();
      setOpen(true);
      const step = event.key === 'ArrowDown' ? 1 : -1;
      const from = active === -1 ? (step === 1 ? -1 : 0) : active;
      setActiveIndex((from + step + options.length) % options.length);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const option = active >= 0 ? options[active] : undefined;
      if (option) activate(option);
      else if (trimmed) go(trimmed);
    } else if (event.key === 'Escape' && open) {
      event.preventDefault();
      close();
    }
  }

  return (
    <div
      ref={rootRef}
      className={cn('relative', className)}
      onBlur={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) close();
      }}
    >
      <SearchIcon
        width={16}
        height={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted"
      />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label={t('label')}
        aria-expanded={showPanel}
        aria-controls={showPanel ? listId : undefined}
        aria-autocomplete="list"
        aria-activedescendant={showPanel && active >= 0 ? optionId(active) : undefined}
        autoComplete="off"
        maxLength={SEARCH_QUERY_MAX}
        placeholder={t('placeholder')}
        value={text}
        onChange={(event) => {
          setText(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={cn(
          'h-10 w-56 rounded-(--radius-input) border border-border bg-surface pr-3 pl-9 text-sm text-foreground lg:w-72',
          'placeholder:text-muted hover:border-muted focus-visible:border-ring',
          'outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        )}
      />
      {showPanel ? (
        <div
          id={listId}
          role="listbox"
          aria-label={t('results')}
          className="absolute top-full right-0 z-50 mt-2 w-[min(24rem,calc(100vw-2rem))] overflow-hidden rounded-(--radius-card) border border-border bg-raised shadow-popover"
        >
          {searching ? (
            <QuickResults
              query={trimmed}
              status={status}
              works={works}
              footerIndex={works.length}
              activeIndex={active}
              optionId={optionId}
              onActivate={activate}
              onRetry={() => void query.refetch()}
              busy={query.isFetching}
            />
          ) : (
            <RecentSearches
              items={recents.items}
              activeIndex={active}
              optionId={optionId}
              onPick={(item) => activate({ kind: 'recent', text: item })}
              onRemove={recents.remove}
              onClear={recents.clear}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
