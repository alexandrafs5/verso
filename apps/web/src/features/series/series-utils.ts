type SeriesEntry = { position: number | null; firstPublishYear: number | null; title: string };

/**
 * Works by `position` ascending, then `firstPublishYear` ascending, then title; unknown values
 * go last (SPEC 18). Open Library has no positions, so its series sort by publication year.
 */
export function sortSeriesWorks<T extends SeriesEntry>(works: readonly T[], locale: string): T[] {
  const compare = (a: number | null, b: number | null): number => {
    if (a === b) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  };
  return [...works].sort(
    (a, b) =>
      compare(a.position, b.position) ||
      compare(a.firstPublishYear, b.firstPublishYear) ||
      a.title.localeCompare(b.title, locale),
  );
}
