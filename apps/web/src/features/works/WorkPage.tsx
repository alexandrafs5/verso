'use client';

import { pickCoverTone, pickDefaultEdition } from '@verso/shared';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { BookCover } from '@/components/verso';
import { EmptyState, ErrorState } from '@/components/verso';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BackButton } from '@/components/shell/BackButton';
import { isCatalogNotFound, isRateLimited } from '@/features/catalog/catalog-errors';
import { LibraryControl } from '@/features/library/LibraryControl';
import { EditionLine } from './EditionLine';
import { EditionSelectorDialog } from './EditionSelectorDialog';
import { pickDescription } from './edition-utils';
import { useWork } from './use-work';
import { useWorkEditions } from './use-work-editions';
import { WorkInfo } from './WorkInfo';

const PAGE = 'mx-auto max-w-(--content-max) px-4 py-8';
const LAYOUT = 'grid gap-8 md:grid-cols-[16rem_minmax(0,1fr)]';

function WorkSkeleton() {
  return (
    <div className={PAGE}>
      <BackButton className="mb-4" />
      <div aria-hidden="true" className={LAYOUT}>
        <Skeleton className="mx-auto aspect-[2/3] w-48 md:mx-0 md:w-64" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-5 w-1/2" />
          {/* The add to library control. */}
          <Skeleton className="h-11 w-52 md:h-10" />
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
  // Local UI state: picking an edition is not persisted and resets with the page (SPEC 18).
  const [selectedRef, setSelectedRef] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const changeRef = useRef<HTMLButtonElement>(null);

  if (work.isPending) return <WorkSkeleton />;

  if (work.isError) {
    if (isCatalogNotFound(work.error)) {
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
          description={isRateLimited(work.error) ? t('rateLimited') : t('errorBody')}
          retryLabel={t('retry')}
          onRetry={() => void work.refetch()}
        />
      </div>
    );
  }

  const data = work.data;
  const editionList = editions.data ?? [];
  // The edition picked here, else the saved one (SPEC 20), else the default (SPEC 18).
  const chosenRef = selectedRef ?? data.libraryStatus?.editionRef;
  const chosen = editionList.find((item) => item.ref === chosenRef);
  const edition = chosen ?? pickDefaultEdition(editionList, locale);
  const authors = data.authors.map((author) => author.name).join(', ');

  return (
    <div className={PAGE}>
      <BackButton className="mb-4" />
      <div className={LAYOUT}>
        <BookCover
          size="lg"
          title={data.title}
          author={authors || undefined}
          // The work cover is what search shows, so it stays until an edition is picked or saved.
          coverUrl={chosen?.coverUrl ?? data.coverUrl}
          coverAlt={t('coverAlt', { title: data.title })}
          tone={pickCoverTone(data.title)}
          className="mx-auto w-48 md:mx-0 md:w-64 [&_img]:shadow-(--shadow-high)"
        />
        <WorkInfo
          work={data}
          description={pickDescription(data.description, editionList, locale)}
          pageCount={edition?.pageCount ?? null}
          librarySlot={
            <LibraryControl
              workRef={data.ref}
              aliases={[workRef]}
              title={data.title}
              libraryStatus={data.libraryStatus}
              editionRef={edition?.ref}
            />
          }
          editionSlot={
            edition ? (
              <EditionLine
                edition={edition}
                onChange={() => setSelectorOpen(true)}
                changeRef={changeRef}
              />
            ) : editions.isPending ? (
              // Same height as the edition line, so the info column does not jump.
              <Skeleton aria-hidden="true" className="h-8 w-2/3" />
            ) : editions.isError ? (
              <p
                role="alert"
                className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted"
              >
                {t('editionsError')}
                <Button variant="secondary" size="sm" onClick={() => void editions.refetch()}>
                  {t('retry')}
                </Button>
              </p>
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
