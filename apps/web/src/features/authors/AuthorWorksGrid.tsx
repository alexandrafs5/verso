'use client';

import { pickCoverTone, type WorkSummary } from '@verso/shared';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { focusRing } from '@/components/shell/nav';
import { BookCover, EmptyState } from '@/components/verso';
import { workHref } from '@/features/catalog/hrefs';
import { cn } from '@/lib/utils';
import { sortAuthorWorks } from './author-utils';

/** The author's works as a cover grid, oldest first. No library status badges before M4. */
export function AuthorWorksGrid({ works }: { works: WorkSummary[] }) {
  const t = useTranslations('author');
  const locale = useLocale();

  if (works.length === 0) {
    return <EmptyState heading={t('worksEmpty')} description={t('worksEmptyHint')} />;
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {sortAuthorWorks(works, locale).map((work) => (
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
