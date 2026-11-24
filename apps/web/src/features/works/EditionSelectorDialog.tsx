'use client';

import { type EditionDto, pickCoverTone } from '@verso/shared';
import { useLocale, useTranslations } from 'next-intl';
import { type RefObject, useState } from 'react';
import { focusRing } from '@/components/shell/nav';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BookCover } from '@/components/verso';
import { cn } from '@/lib/utils';
import { languageName } from './edition-utils';

type EditionSelectorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editions: EditionDto[];
  /** Ref of the edition currently selected on S3. */
  selectedRef: string;
  onSelect: (ref: string) => void;
  /** Focus goes back here on close. The opener sits outside the dialog, so Radix cannot do it. */
  returnFocusRef: RefObject<HTMLElement | null>;
};

/** Distinct non-null languages, in order of first appearance. */
export function editionLanguages(editions: readonly EditionDto[]): string[] {
  return [...new Set(editions.flatMap((edition) => (edition.language ? [edition.language] : [])))];
}

function EditionList({
  editions,
  selectedRef,
  onSelect,
}: Pick<EditionSelectorDialogProps, 'editions' | 'selectedRef' | 'onSelect'>) {
  const t = useTranslations('editions');
  const locale = useLocale();
  // The list is unmounted when the dialog closes, so the filter resets on every open.
  const [language, setLanguage] = useState<string | null>(null);

  const languages = editionLanguages(editions);
  const visible = language ? editions.filter((edition) => edition.language === language) : editions;
  // A single language makes the filter pointless, so the chips are hidden.
  const showChips = languages.length > 1;

  return (
    <>
      {showChips ? (
        <div role="group" aria-label={t('languageFilter')} className="flex flex-wrap gap-2">
          {[null, ...languages].map((code) => (
            <button
              key={code ?? 'all'}
              type="button"
              aria-pressed={language === code}
              onClick={() => setLanguage(code)}
              className={cn(
                'inline-flex min-h-11 items-center rounded-(--radius-chip) border border-border px-3 text-sm md:min-h-8',
                language === code
                  ? 'bg-accent text-on-accent'
                  : 'bg-surface text-foreground hover:bg-raised',
                focusRing,
              )}
            >
              {code === null ? t('allLanguages') : languageName(code, locale)}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="divide-y divide-border">
        {visible.map((edition) => {
          const selected = edition.ref === selectedRef;
          const line1 = [
            edition.language ? languageName(edition.language, locale) : null,
            edition.publisher,
            edition.publishYear === null ? null : String(edition.publishYear),
          ].filter((part): part is string => part !== null && part !== '');
          const line2 = [
            edition.pageCount === null ? null : t('pages', { count: edition.pageCount }),
            t(`formats.${edition.format}`),
            (edition.isbn13 ?? edition.isbn10)
              ? t('isbn', { isbn: (edition.isbn13 ?? edition.isbn10) as string })
              : null,
          ].filter((part): part is string => part !== null);

          return (
            <li key={edition.ref}>
              <button
                type="button"
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect(edition.ref)}
                className={cn(
                  'flex min-h-11 w-full gap-3 rounded-(--radius-card) px-2 py-3 text-left hover:bg-surface',
                  selected && 'bg-surface',
                  focusRing,
                )}
              >
                <BookCover
                  size="sm"
                  title={edition.title}
                  coverUrl={edition.coverUrl}
                  coverAlt={t('coverAlt', { title: edition.title })}
                  tone={pickCoverTone(edition.title)}
                />
                <span className="min-w-0 flex-1">
                  {line1.length > 0 ? (
                    <span className="block text-sm break-words text-foreground">
                      {line1.join(' · ')}
                    </span>
                  ) : null}
                  <span className="block text-sm break-words text-muted">{line2.join(' · ')}</span>
                  {selected ? (
                    <span className="mt-1 inline-block rounded-(--radius-chip) border border-border px-2 text-xs text-foreground">
                      {t('selected')}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </>
  );
}

/** S4. Choosing an edition is local UI state: nothing is persisted (SPEC 18). */
export function EditionSelectorDialog({
  open,
  onOpenChange,
  editions,
  selectedRef,
  onSelect,
  returnFocusRef,
}: EditionSelectorDialogProps) {
  const t = useTranslations('editions');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeLabel={t('close')}
        className="max-w-xl"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <EditionList
          editions={editions}
          selectedRef={selectedRef}
          onSelect={(ref) => {
            onSelect(ref);
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
