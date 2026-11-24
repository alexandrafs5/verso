'use client';

import type { WorkSummary } from '@verso/shared';
import { pickCoverTone } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BookCover } from '@/components/verso';
import { focusRing } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

export function workHref(ref: string): string {
  return `/works/${encodeURIComponent(ref)}`;
}

export function SearchResultRow({ work }: { work: WorkSummary }) {
  const t = useTranslations('search.page');
  const authors = work.authors.map((a) => a.name).join(', ');
  const meta = [
    work.firstPublishYear === null ? null : String(work.firstPublishYear),
    work.editionCount === null ? null : t('editions', { count: work.editionCount }),
  ].filter((part): part is string => part !== null);

  return (
    <li>
      <Link
        href={workHref(work.ref)}
        className={cn(
          'flex gap-4 rounded-(--radius-card) px-2 py-3 hover:bg-surface md:px-3',
          focusRing,
        )}
      >
        <BookCover
          size="sm"
          title={work.title}
          author={authors || undefined}
          coverUrl={work.coverUrl}
          coverAlt={t('coverAlt', { title: work.title })}
          tone={pickCoverTone(work.title)}
        />
        <div className="min-w-0 flex-1">
          <p className="break-words font-serif text-lg leading-snug text-foreground">
            {work.title}
          </p>
          {authors ? (
            <p className="break-words text-sm text-muted">{t('authorsBy', { authors })}</p>
          ) : null}
          {meta.length > 0 ? <p className="mt-1 text-sm text-muted">{meta.join(' · ')}</p> : null}
        </div>
      </Link>
    </li>
  );
}
