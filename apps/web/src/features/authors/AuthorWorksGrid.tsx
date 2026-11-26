'use client';

import { pickCoverTone, type WorkSummary } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/shell/nav';
import { BookCover, EmptyState, StatusBadge } from '@/components/verso';
import { workHref } from '@/features/catalog/hrefs';
import { cn } from '@/lib/utils';

/**
 * The author's works as a cover grid, in the order the API gives (release year, SPEC 18). The API
 * orders them because Open Library's first publication year is often wrong. A book in the library
 * has a status badge on its cover (SPEC 20).
 */
export function AuthorWorksGrid({ works }: { works: WorkSummary[] }) {
  const t = useTranslations('author');
  const tStatus = useTranslations('status');
  const tLibrary = useTranslations('library');

  if (works.length === 0) {
    return <EmptyState heading={t('worksEmpty')} description={t('worksEmptyHint')} />;
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-6 md:grid-cols-4 min-[1200px]:grid-cols-6">
      {works.map((work) => (
        <li key={work.ref}>
          <Link
            href={workHref(work.ref)}
            className={cn('block rounded-(--radius-card) hover:opacity-90', focusRing)}
          >
            <div className="relative">
              <BookCover
                size="md"
                title={work.title}
                coverUrl={work.coverUrl}
                coverAlt={t('coverAlt', { title: work.title })}
                tone={pickCoverTone(work.title)}
                className="w-full"
              />
              {work.libraryStatus ? (
                // Inside the link, so the status is part of its name.
                <StatusBadge
                  label={tStatus(work.libraryStatus.status)}
                  count={
                    work.libraryStatus.readCount >= 2
                      ? {
                          short: tLibrary('readCountShort', {
                            count: work.libraryStatus.readCount,
                          }),
                          accessible: tLibrary('readCount', {
                            count: work.libraryStatus.readCount,
                          }),
                        }
                      : undefined
                  }
                  className="absolute bottom-1 left-1 max-w-[calc(100%-0.5rem)]"
                />
              ) : null}
            </div>
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
