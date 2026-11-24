'use client';

import type { WorkSummary } from '@verso/shared';
import { useId, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { SearchResultRow } from './SearchResultRow';

/**
 * The folded 1-edition tail of the loaded pages behind one button (SPEC 17). The expanded state
 * is local, so the parent remounts it with a new `key` when the query changes.
 */
export function MoreMatches({ works }: { works: WorkSummary[] }) {
  const t = useTranslations('search.page');
  const listId = useId();
  const [expanded, setExpanded] = useState(false);

  if (works.length === 0) return null;

  return (
    <div className="mt-4">
      <Button
        variant="secondary"
        className="w-full md:w-auto"
        aria-expanded={expanded}
        aria-controls={listId}
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded
          ? t('hideMoreMatches', { count: works.length })
          : t('showMoreMatches', { count: works.length })}
      </Button>
      <ul id={listId} hidden={!expanded} className="mt-2 divide-y divide-border">
        {works.map((work) => (
          <SearchResultRow key={work.ref} work={work} />
        ))}
      </ul>
    </div>
  );
}
