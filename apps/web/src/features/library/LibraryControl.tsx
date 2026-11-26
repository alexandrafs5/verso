'use client';

import type { BookStatus, LibraryStatus } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { useRef } from 'react';
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

  const onAdd = (status: BookStatus) =>
    add.mutate(
      { body: { workRef, editionRef, status }, aliases },
      {
        // The pressed button is disabled or replaced, which drops the focus to the page. Keep
        // the keyboard user here, unless they have moved on.
        onSettled: () =>
          requestAnimationFrame(() => {
            if (document.activeElement === document.body) wrapper.current?.focus();
          }),
      },
    );

  return (
    <div
      ref={wrapper}
      tabIndex={-1}
      className={cn(
        'inline-flex max-w-full items-center gap-2 rounded-(--radius-button)',
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
