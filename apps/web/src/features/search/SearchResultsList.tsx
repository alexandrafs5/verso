'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, ErrorState } from '@/components/verso';
import { ApiError } from '@/lib/api-client';
import { MoreMatches } from './MoreMatches';
import { SearchResultRow } from './SearchResultRow';
import { flattenSearchPages, useSearchBooks } from './use-search-books';

export const MANUAL_ADD_HREF = '/books/new';

export function ManualAddLink() {
  const t = useTranslations('search.page');
  return (
    <p className="mt-6 text-sm">
      <Link
        href={MANUAL_ADD_HREF}
        className="inline-flex min-h-11 items-center text-accent-text underline-offset-4 hover:underline md:min-h-0"
      >
        {t('manualAdd')}
      </Link>
    </p>
  );
}

function SkeletonRows() {
  return (
    <ul aria-hidden="true" className="divide-y divide-border">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="md:flex md:items-center md:gap-4">
          <div className="flex gap-4 px-2 py-3 md:flex-1 md:px-3">
            <Skeleton className="aspect-[2/3] w-16 shrink-0" />
            <div className="flex-1 space-y-2 pt-1">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
          {/* The add to library control. */}
          <div className="pb-3 pl-22 md:pr-3 md:pb-0 md:pl-0">
            <Skeleton className="h-11 w-44 md:h-10 md:w-52" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function errorBody(error: unknown, t: (key: 'rateLimited' | 'errorBody') => string): string {
  return error instanceof ApiError && error.status === 429 ? t('rateLimited') : t('errorBody');
}

/** `q` may be absent for a genre-only search (SPEC 18). */
export function SearchResultsList({ q, genre }: { q?: string; genre?: string }) {
  const t = useTranslations('search.page');
  const ts = useTranslations('search');
  const query = useSearchBooks({ q: q ?? '', genre, minLength: 1 });
  const label = q ?? genre ?? '';

  if (query.isPending) return <SkeletonRows />;

  if (query.isError && !query.data) {
    return (
      <ErrorState
        heading={t('errorHeading')}
        description={errorBody(query.error, t)}
        retryLabel={ts('retry')}
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { items, moreMatches } = flattenSearchPages(query.data?.pages);

  if (items.length === 0 && moreMatches.length === 0) {
    return (
      <div>
        <p role="status" className="sr-only">
          {ts('noMatch', { query: label })}
        </p>
        <EmptyState heading={ts('noMatch', { query: label })} description={ts('noMatchHint')} />
        <div className="text-center">
          <ManualAddLink />
        </div>
      </div>
    );
  }

  const loadMoreFailed = query.isFetchNextPageError;

  return (
    <div>
      <ul className="divide-y divide-border">
        {items.map((work, index) => (
          // Not the ref: adding a book changes it, and the row must keep its focus.
          <SearchResultRow key={`${index}-${work.title}`} work={work} />
        ))}
      </ul>
      <MoreMatches key={`${q ?? ''}|${genre ?? ''}`} works={moreMatches} />
      <div role="status" className="sr-only">
        {query.isFetchingNextPage ? t('loadingMore') : t('resultsLoaded', { count: items.length })}
      </div>
      {loadMoreFailed ? (
        <p role="alert" className="mt-4 text-sm text-danger">
          {t('loadMoreError')}
        </p>
      ) : null}
      {query.hasNextPage ? (
        <div className="mt-4">
          {/* aria-disabled keeps keyboard focus while the request runs. */}
          <Button
            variant="secondary"
            aria-disabled={query.isFetchingNextPage}
            onClick={() => {
              if (!query.isFetchingNextPage) void query.fetchNextPage();
            }}
          >
            {query.isFetchingNextPage
              ? t('loadingMore')
              : loadMoreFailed
                ? ts('retry')
                : t('loadMore')}
          </Button>
        </div>
      ) : null}
      <ManualAddLink />
    </div>
  );
}
