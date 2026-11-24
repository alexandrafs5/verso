'use client';

import { pickCoverTone } from '@verso/shared';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { BookCover } from '@/components/verso';
import { EmptyState, ErrorState } from '@/components/verso';
import { Skeleton } from '@/components/ui/skeleton';
import { isCatalogNotFound, isRateLimited } from '@/features/catalog/catalog-errors';
import { EditionLine } from './EditionLine';
import { EditionSelectorDialog } from './EditionSelectorDialog';
import { pickDefaultEdition } from './edition-utils';
import { useWork } from './use-work';
import { useWorkEditions } from './use-work-editions';
import { WorkInfo } from './WorkInfo';

const PAGE = 'mx-auto max-w-[1200px] px-4 py-8';
const LAYOUT = 'grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]';

function WorkSkeleton() {
  return (
    <div className={PAGE}>
      <div aria-hidden="true" className={LAYOUT}>
        <Skeleton className="mx-auto aspect-[2/3] w-48 md:mx-0 md:w-64" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </div>
  );
}

function WorkView({ workRef }: { workRef: string }) {
  const t = useTranslations('work');
  const locale = useLocale();
  const router = useRouter();
  const work = useWork(workRef);
  const editions = useWorkEditions(workRef);
  // Local UI state: the selection is not persisted and resets with the page (SPEC 18).
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const changeRef = useRef<HTMLButtonElement>(null);

  if (work.isPending) return <WorkSkeleton />;

  if (work.isError) {
    if (isCatalogNotFound(work.error)) {
      return (
        <div className={PAGE}>
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
        <ErrorState
          heading={t('errorHeading')}
          description={isRateLimited(work.error) ? t('rateLimited') : t('errorBody')}
          retryLabel={t('retry')}
          onRetry={() => void work.refetch()}
        />
      </div>
    );
  }

  const data = work.data;
  // Default: the first edition in the UI language, else the first one (SPEC 18).
  const editionList = editions.data ?? [];
  const edition =
    editionList.find((item) => item.ref === selectedRef) ?? pickDefaultEdition(editionList, locale);
  const authors = data.authors.map((author) => author.name).join(', ');

  return (
    <div className={PAGE}>
      <div className={LAYOUT}>
        <BookCover
          size="lg"
          title={data.title}
          author={authors || undefined}
          // The work cover is what search shows, so it stays until the user picks an edition.
          coverUrl={selectedRef && edition ? (edition.coverUrl ?? data.coverUrl) : data.coverUrl}
          coverAlt={t('coverAlt', { title: data.title })}
          tone={pickCoverTone(data.title)}
          className="mx-auto w-48 md:mx-0 md:w-64 [&_img]:shadow-(--shadow-high)"
        />
        <WorkInfo
          work={data}
          pageCount={edition?.pageCount ?? null}
          editionSlot={
            edition ? (
              <EditionLine
                edition={edition}
                onChange={() => setSelectorOpen(true)}
                changeRef={changeRef}
              />
            ) : null
          }
        />
      </div>
      {edition ? (
        <EditionSelectorDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          editions={editionList}
          selectedRef={edition.ref}
          onSelect={setSelectedRef}
          returnFocusRef={changeRef}
        />
      ) : null}
    </div>
  );
}

/** S3. Remounts per ref so the selected edition never leaks between works. */
export function WorkPage({ workRef }: { workRef: string }) {
  return <WorkView key={workRef} workRef={workRef} />;
}
