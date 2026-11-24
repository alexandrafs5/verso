'use client';

import { pickCoverTone, type SeriesDetail } from '@verso/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/shell/nav';
import { BookCover, EmptyState, ErrorState } from '@/components/verso';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/shell/BackButton';
import { isCatalogNotFound, isRateLimited } from '@/features/catalog/catalog-errors';
import { workHref } from '@/features/catalog/hrefs';
import { cn } from '@/lib/utils';
import { useSeries } from './use-series';

const PAGE = 'mx-auto max-w-(--content-max) px-4 py-8';

function SeriesSkeleton() {
  return (
    <div className={PAGE}>
      <BackButton className="mb-4" />
      <div aria-hidden="true" className="space-y-6">
        <Skeleton className="h-10 w-1/2" />
        <ul className="divide-y divide-border">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-6 w-6" />
              <Skeleton className="aspect-[2/3] w-16 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/4" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SeriesWorks({ works }: { works: SeriesDetail['works'] }) {
  const t = useTranslations('series');

  if (works.length === 0) {
    return <EmptyState heading={t('worksEmpty')} description={t('worksEmptyHint')} />;
  }

  return (
    <ol className="divide-y divide-border">
      {works.map((work) => (
        <li key={work.ref}>
          <Link
            href={workHref(work.ref)}
            className={cn(
              'flex items-center gap-4 rounded-(--radius-card) px-2 py-3 hover:bg-surface md:px-3',
              focusRing,
            )}
          >
            {/* Reserve the number column so rows without a position stay aligned. */}
            <span className="w-8 shrink-0 text-center font-serif text-xl text-muted">
              {work.position === null ? null : work.position}
            </span>
            <BookCover
              size="sm"
              title={work.title}
              coverUrl={work.coverUrl}
              coverAlt={t('coverAlt', { title: work.title })}
              tone={pickCoverTone(work.title)}
            />
            <span className="min-w-0 flex-1">
              <span className="block font-serif text-lg leading-snug break-words text-foreground">
                {work.title}
              </span>
              {work.firstPublishYear === null ? null : (
                <span className="block text-sm text-muted">{work.firstPublishYear}</span>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

function SeriesView({ seriesId }: { seriesId: string }) {
  const t = useTranslations('series');
  const router = useRouter();
  const series = useSeries(seriesId);

  if (series.isPending) return <SeriesSkeleton />;

  if (series.isError) {
    if (isCatalogNotFound(series.error)) {
      return (
        <div className={PAGE}>
          <BackButton className="mb-4" />
          <EmptyState
            heading={t('notFoundHeading')}
            description={t('notFoundBody')}
            action={{ label: t('searchAgain'), onClick: () => router.push('/search') }}
          />
        </div>
      );
    }
    return (
      <div className={PAGE}>
        <BackButton className="mb-4" />
        <ErrorState
          heading={t('errorHeading')}
          description={isRateLimited(series.error) ? t('rateLimited') : t('errorBody')}
          retryLabel={t('retry')}
          onRetry={() => void series.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <BackButton className="mb-4" />
      <h1 className="font-serif text-3xl leading-tight break-words md:text-4xl">
        {series.data.name}
      </h1>
      <section aria-label={t('worksHeading')} className="mt-6">
        <SeriesWorks works={series.data.works} />
      </section>
    </div>
  );
}

/** S6. Remounts per id so the state of one series never leaks into the next. */
export function SeriesPage({ seriesId }: { seriesId: string }) {
  return <SeriesView key={seriesId} seriesId={seriesId} />;
}
