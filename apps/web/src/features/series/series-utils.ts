/** Works by `position` ascending, unknown positions last, ties by title (SPEC 18). */
export function sortSeriesWorks<T extends { position: number | null; title: string }>(
  works: readonly T[],
  locale: string,
): T[] {
  return [...works].sort((a, b) => {
    if (a.position !== b.position) {
      if (a.position === null) return 1;
      if (b.position === null) return -1;
      return a.position - b.position;
    }
    return a.title.localeCompare(b.title, locale);
  });
}
