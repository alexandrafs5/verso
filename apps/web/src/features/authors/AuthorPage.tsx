'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EmptyState, ErrorState } from '@/components/verso';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/shell/BackButton';
import { isCatalogNotFound, isRateLimited } from '@/features/catalog/catalog-errors';
import { AuthorHeader } from './AuthorHeader';
import { AuthorWorksGrid } from './AuthorWorksGrid';
import { useAuthor } from './use-author';

const PAGE = 'mx-auto max-w-(--content-max) px-4 py-8';

function AuthorSkeleton() {
  return (
    <div className={PAGE}>
      <BackButton className="mb-4" />
      <div aria-hidden="true" className="space-y-10">
        <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <Skeleton className="size-32 rounded-full md:size-40" />
          <div className="w-full flex-1 space-y-3">
            <Skeleton className="h-10 w-1/2" />
            <Skeleton className="h-5 w-1/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 min-[1200px]:grid-cols-6">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i}>
              <Skeleton className="aspect-[2/3] w-full" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function AuthorView({ authorRef }: { authorRef: string }) {
  const t = useTranslations('author');
  const router = useRouter();
  const author = useAuthor(authorRef);

  if (author.isPending) return <AuthorSkeleton />;

  if (author.isError) {
    if (isCatalogNotFound(author.error)) {
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
          description={isRateLimited(author.error) ? t('rateLimited') : t('errorBody')}
          retryLabel={t('retry')}
          onRetry={() => void author.refetch()}
        />
      </div>
    );
  }

  return (
    <div className={PAGE}>
      <BackButton className="mb-4" />
      <AuthorHeader author={author.data} />
      <section className="mt-10">
        <h2 className="mb-4 font-serif text-2xl">{t('worksHeading')}</h2>
        <AuthorWorksGrid works={author.data.works} />
      </section>
    </div>
  );
}

/** S5. Remounts per ref so the state of one author never leaks into the next. */
export function AuthorPage({ authorRef }: { authorRef: string }) {
  return <AuthorView key={authorRef} authorRef={authorRef} />;
}
