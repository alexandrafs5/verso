import type { WorkSummary } from '@verso/shared';

/** Works by `firstPublishYear` ascending, unknown years last, ties by title (SPEC 18). */
export function sortAuthorWorks<T extends Pick<WorkSummary, 'firstPublishYear' | 'title'>>(
  works: readonly T[],
  locale: string,
): T[] {
  return [...works].sort((a, b) => {
    if (a.firstPublishYear !== b.firstPublishYear) {
      if (a.firstPublishYear === null) return 1;
      if (b.firstPublishYear === null) return -1;
      return a.firstPublishYear - b.firstPublishYear;
    }
    return a.title.localeCompare(b.title, locale);
  });
}

/** Up to two initials: first letter of the first and the last word. */
export function authorInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0] as string;
  const last = words.length > 1 ? (words[words.length - 1] as string) : '';
  return `${[...first][0] ?? ''}${[...last][0] ?? ''}`.toUpperCase();
}
