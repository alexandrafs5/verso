'use client';

import type { BookStatus, LibraryStatus } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { focusRing } from '@/components/shell/nav';
import { AddToLibraryButton } from '@/components/verso';
import { cn } from '@/lib/utils';
import { useAddToLibrary } from './use-add-to-library';

type LibraryControlProps = {
  workRef: string;
  /** Used in the accessible names, so the buttons of a list differ. */
  title: string;
  libraryStatus: LibraryStatus | null;
  /** The edition to add. Without it the server picks the default one. */
  editionRef?: string;
  aliases?: string[];
  className?: string;
};

/** The add to library control of the catalog screens (DESIGN "Add-to-library control"). */
export function LibraryControl({
  workRef,
  title,
  libraryStatus,
  editionRef,
  aliases,
  className,
}: LibraryControlProps) {
  const t = useTranslations();
  const add = useAddToLibrary();
  const wrapper = useRef<HTMLDivElement>(null);

  const options: Record<BookStatus, string> = {
    WANT_TO_READ: t('status.WANT_TO_READ'),
    READING: t('status.READING'),
    READ: t('status.READ'),
    ABANDONED: t('status.ABANDONED'),
  };
  const readCount = libraryStatus?.readCount ?? 0;

  // The pressed button is disabled while pending and replaced after a success, which drops the
  // focus to the page. Keep the keyboard user here, unless they have moved on: on the status
  // after a success, back on the button after a failure. An effect, so it runs after the render.
  // Never scrolls: the user may be reading elsewhere by the time a slow add ends.
  const { isSuccess, isError } = add;
  useEffect(() => {
    if (!isSuccess && !isError) return;
    const element = wrapper.current;
    if (!element) return;
    const active = document.activeElement;
    if (active !== document.body && !element.contains(active)) return;
    const target = isSuccess ? element : element.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
  }, [isSuccess, isError]);

  const onAdd = (status: BookStatus) =>
    add.mutate({ body: { workRef, editionRef, status }, aliases });

  return (
    <div
      ref={wrapper}
      tabIndex={-1}
      role="group"
      aria-label={title}
      className={cn(
        'inline-flex max-w-full flex-wrap items-center gap-2 rounded-(--radius-button)',
        focusRing,
        className,
      )}
    >
      <AddToLibraryButton
        status={libraryStatus?.status ?? null}
        labels={{
          add: options.WANT_TO_READ,
          addAriaLabel: t('library.wantToReadFor', { title }),
          menu: t('library.chooseStatusFor', { title }),
          options,
        }}
        onAdd={onAdd}
        // Changing the status arrives in M4.3.
        onChange={() => {}}
        statusDisabled
        pending={add.isPending}
      />
      {readCount >= 2 ? (
        <span className="text-sm text-muted">
          <span aria-hidden="true">{t('library.readCountShort', { count: readCount })}</span>
          <span className="sr-only">{t('library.readCount', { count: readCount })}</span>
        </span>
      ) : null}
    </div>
  );
}
