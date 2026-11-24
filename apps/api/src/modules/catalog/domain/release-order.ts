import type { WorkSearchResult } from '../../../infra/catalog/catalog-provider.js';

/**
 * Open Library's `first_publish_year` is often wrong (the first edition of "Rhythm of War" is
 * dated 2011, nine years early), which breaks any order by publication year. The provider also
 * gives a `typicalYear` that ignores one stray early date. This orders works by that year, then
 * by `firstPublishYear`, and unknown years go last. Ties keep a stable title order.
 * Pure, no Nest or Prisma imports.
 */
export const releaseYear = (
  work: Pick<WorkSearchResult, 'typicalYear' | 'firstPublishYear'>,
): number | null => work.typicalYear ?? work.firstPublishYear;

export function sortByReleaseYear<
  T extends Pick<WorkSearchResult, 'typicalYear' | 'firstPublishYear' | 'title'>,
>(works: readonly T[]): T[] {
  return [...works].sort((a, b) => {
    const ya = releaseYear(a);
    const yb = releaseYear(b);
    if (ya !== yb) {
      if (ya === null) return 1;
      if (yb === null) return -1;
      return ya - yb;
    }
    return a.title < b.title ? -1 : a.title > b.title ? 1 : 0;
  });
}
