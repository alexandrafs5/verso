'use client';

import { mapWorkGenres } from '@verso/shared';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { focusRing } from '@/components/shell/nav';
import { searchHref } from '@/features/search/search-href';
import { cn } from '@/lib/utils';

/** Chips for the genres of a work that map to the fixed list. Renders nothing when none do. */
export function GenreChips({ genres }: { genres: string[] }) {
  const t = useTranslations('genres');
  const tw = useTranslations('work');
  const chips = mapWorkGenres(genres);
  if (chips.length === 0) return null;

  return (
    <ul aria-label={tw('genresLabel')} className="flex flex-wrap gap-2">
      {chips.map((chip) => (
        <li key={chip.slug}>
          <Link
            href={searchHref('', chip.subject)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-(--radius-chip) border border-border bg-surface px-3 text-sm hover:bg-raised md:min-h-8',
              focusRing,
            )}
          >
            {t(chip.slug)}
          </Link>
        </li>
      ))}
    </ul>
  );
}
