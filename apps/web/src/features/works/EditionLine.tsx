'use client';

import type { EditionDto } from '@verso/shared';
import { useLocale, useTranslations } from 'next-intl';
import type { Ref } from 'react';
import { Button } from '@/components/ui/button';
import { languageName } from './edition-utils';

type EditionLineProps = {
  edition: EditionDto;
  /** Opens the edition selector. The button is hidden without it. */
  onChange?: () => void;
  /** Ref of the Change button, so the selector can return focus to it. */
  changeRef?: Ref<HTMLButtonElement>;
};

/** "Edition: Spanish · Cátedra · 1955 · 128 pages · Change". Null parts are omitted. */
export function EditionLine({ edition, onChange, changeRef }: EditionLineProps) {
  const t = useTranslations('work');
  const locale = useLocale();
  const details = [
    edition.language ? languageName(edition.language, locale) : null,
    edition.publisher,
    edition.publishYear === null ? null : String(edition.publishYear),
    edition.pageCount === null ? null : t('pages', { count: edition.pageCount }),
  ].filter((part): part is string => part !== null && part !== '');

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
      {details.length > 0 ? <p>{t('editionLine', { details: details.join(' · ') })}</p> : null}
      {onChange ? (
        <Button ref={changeRef} variant="secondary" size="sm" onClick={onChange}>
          {t('change')}
        </Button>
      ) : null}
    </div>
  );
}
