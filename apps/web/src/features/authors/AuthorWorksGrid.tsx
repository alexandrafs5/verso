'use client';

import { pickCoverTone, type WorkSummary } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/shell/nav';
import { BookCover, EmptyState } from '@/components/verso';
import { workHref } from '@/features/catalog/hrefs';
import { cn } from '@/lib/utils';

/**
 * The author's works as a cover grid, in the order the API gives (release year, SPEC 18). The API
 * orders them because Open Library's first publication year is often wrong. No library status
 * badges before M4.
 */
export function AuthorWorksGrid({ works }: { works: WorkSummary[] }) {
  const t = useTranslations('author');

  if (works.length === 0) {
    return <EmptyState heading={t('worksEmpty')} description={t('worksEmptyHint')} />;
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {works.map((work) => (
        <li key={work.ref}>
          <Link
            href={workHref(work.ref)}
            className={cn('block rounded-(--radius-card) hover:opacity-90', focusRing)}
          >
            <BookCover
              size="md"
              title={work.title}
              coverUrl={work.coverUrl}
              coverAlt={t('coverAlt', { title: work.title })}
              tone={pickCoverTone(work.title)}
              className="w-full"
            />
            <p className="mt-2 text-sm leading-snug break-words text-foreground">{work.title}</p>
            {work.firstPublishYear === null ? null : (
              <p className="text-sm text-muted">{work.firstPublishYear}</p>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
