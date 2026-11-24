'use client';

import type { WorkDetail } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { focusRing } from '@/components/shell/nav';
import { authorHref, seriesHref } from '@/features/catalog/hrefs';
import { cn } from '@/lib/utils';
import { GenreChips } from './GenreChips';
import { Synopsis } from './Synopsis';

const linkClass = cn('text-accent-text underline-offset-4 hover:underline', focusRing);

type WorkInfoProps = {
  work: WorkDetail;
  /** The description to show, already picked for the reader's language. */
  description: string | null;
  /** Page count of the selected edition, or null when unknown. */
  pageCount: number | null;
  /** The edition line, rendered by the page once editions are loaded. */
  editionSlot?: ReactNode;
};

export function WorkInfo({ work, description, pageCount, editionSlot }: WorkInfoProps) {
  const t = useTranslations('work');
  const meta = [
    work.firstPublishYear === null ? null : t('firstPublished', { year: work.firstPublishYear }),
    pageCount === null ? null : t('pages', { count: pageCount }),
  ].filter((part): part is string => part !== null);

  return (
    <div className="min-w-0 space-y-4">
      <div>
        <h1 className="font-serif text-3xl leading-tight break-words md:text-4xl">{work.title}</h1>
        {work.subtitle ? (
          <p className="mt-1 font-serif text-xl break-words text-muted">{work.subtitle}</p>
        ) : null}
      </div>

      {work.authors.length > 0 ? (
        <p className="break-words">
          {work.authors.map((author, index) => (
            <span key={author.ref}>
              {index > 0 ? ', ' : null}
              <Link href={authorHref(author.ref)} className={linkClass}>
                {author.name}
              </Link>
            </span>
          ))}
        </p>
      ) : null}

      {work.series ? (
        <p className="text-sm">
          <Link href={seriesHref(work.series.id)} className={linkClass}>
            {work.series.position === null
              ? t('seriesPart', { name: work.series.name })
              : t('seriesBook', { position: work.series.position, name: work.series.name })}
          </Link>
        </p>
      ) : null}

      <GenreChips genres={work.genres} />

      {meta.length > 0 ? <p className="text-sm text-muted">{meta.join(' · ')}</p> : null}

      {editionSlot}

      {description ? (
        <Synopsis text={description} readMoreLabel={t('readMore')} readLessLabel={t('readLess')} />
      ) : null}
    </div>
  );
}
