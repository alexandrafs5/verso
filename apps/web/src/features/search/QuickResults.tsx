'use client';

import { type WorkSummary, pickCoverTone } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { Skeleton } from '@/components/ui/skeleton';
import { BookCover } from '@/components/verso';
import { cn } from '@/lib/utils';

export type QuickOption =
  { kind: 'recent'; text: string } | { kind: 'work'; work: WorkSummary } | { kind: 'all' };

export type QuickStatus = 'loading' | 'error' | 'empty' | 'ready';

type Props = {
  query: string;
  status: QuickStatus;
  works: WorkSummary[];
  /** Index in the option list of the first work (always 0) and of the footer item. */
  footerIndex: number;
  activeIndex: number;
  optionId: (index: number) => string;
  onActivate: (option: QuickOption) => void;
  onRetry: () => void;
  busy: boolean;
};

const rowBase = 'flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left';

export function QuickResults({
  query,
  status,
  works,
  footerIndex,
  activeIndex,
  optionId,
  onActivate,
  onRetry,
  busy,
}: Props) {
  const t = useTranslations('search');
  const tp = useTranslations('search.page');

  return (
    <div aria-busy={busy}>
      {status === 'loading' ? (
        <div role="status" aria-label={t('searching')} className="space-y-2 px-3 py-2">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-12 w-8 shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {status === 'error' ? (
        <div role="alert" className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
          <span className="text-muted">{t('quickError')}</span>
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onRetry}
            className="text-accent-text hover:underline"
          >
            {t('retry')}
          </button>
        </div>
      ) : null}

      {status === 'empty' ? (
        <p className="px-3 py-3 text-sm text-muted">{t('noMatch', { query })}</p>
      ) : null}

      {works.map((work, index) => {
        const authors = work.authors.map((a) => a.name).join(', ');
        return (
          <div
            key={work.ref}
            id={optionId(index)}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onActivate({ kind: 'work', work })}
            className={cn(rowBase, index === activeIndex ? 'bg-surface' : 'hover:bg-surface')}
          >
            <BookCover
              size="sm"
              title={work.title}
              author={authors || undefined}
              coverUrl={work.coverUrl}
              coverAlt={tp('coverAlt', { title: work.title })}
              tone={pickCoverTone(work.title)}
              className="w-8"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate font-serif text-base text-foreground">
                {work.title}
              </span>
              {authors ? (
                <span className="block truncate text-xs text-muted">{authors}</span>
              ) : null}
            </span>
          </div>
        );
      })}

      <div
        id={optionId(footerIndex)}
        role="option"
        aria-selected={footerIndex === activeIndex}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onActivate({ kind: 'all' })}
        className={cn(
          rowBase,
          'border-t border-border text-sm text-accent-text',
          footerIndex === activeIndex ? 'bg-surface' : 'hover:bg-surface',
        )}
      >
        {t('seeAll')}
      </div>
    </div>
  );
}
