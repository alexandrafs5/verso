import type { WorkSearchResult } from '../../../infra/catalog/catalog-provider';

export type CollapseOptions = {
  /**
   * True on the first page only. When no group there has more than 1 edition, nothing folds,
   * so the first screen never shows only a fold button (SPEC 17).
   */
  guardVisible: boolean;
};

/** A row of the results: its representative work, plus every work key merged into it. */
export type CollapsedWork = WorkSearchResult & { mergedKeys: string[] };

export type CollapsedSearch = {
  items: CollapsedWork[];
  moreMatches: CollapsedWork[];
};

const squash = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

/** Normalizes an author name the same way as a title, so the two can be compared. */
const normalizeName = (name: string): string => squash(name);

/**
 * Title used to decide whether two results are the same book: no accents or case, no subtitle
 * after ":" or " / ", no parenthetical text, and no trailing author name ("de Juan Rulfo").
 */
export function normalizeTitle(title: string, authorNames: string[] = []): string {
  const cut = title.split(':')[0]?.split(' / ')[0] ?? title;
  const normalized = squash(cut.replace(/\([^)]*\)/g, ' '));

  for (const name of authorNames.map(normalizeName).filter((n) => n.length > 0)) {
    for (const suffix of [` de ${name}`, ` ${name}`]) {
      if (normalized.length > suffix.length && normalized.endsWith(suffix)) {
        return normalized.slice(0, -suffix.length).trim();
      }
    }
  }
  return normalized;
}

/**
 * Author name as a comparable key: no accents or case, and the words sorted, so
 * "Reyes, Alfonso" and "Alfonso Reyes" match. Open Library often gives one person several author keys.
 */
export function normalizeAuthorName(name: string): string {
  return squash(name).split(' ').filter(Boolean).sort().join(' ');
}

const groupKey = (result: WorkSearchResult): string =>
  `${normalizeTitle(
    result.title,
    result.authors.map((a) => a.name),
  )}|${normalizeAuthorName(result.authors[0]?.name ?? '')}`;

/** A missing or zero count is treated as 1 for folding. */
const effectiveCount = (result: WorkSearchResult): number => Math.max(result.editionCount, 1);

/**
 * Merges near-duplicate results of one provider page and splits the 1-edition tail into
 * `moreMatches`. Pure and order-preserving: a group sits where its first member was, and the
 * input is not sorted again.
 */
export function collapseSearchResults(
  results: WorkSearchResult[],
  opts: CollapseOptions,
): CollapsedSearch {
  const groups = new Map<string, WorkSearchResult[]>();
  for (const result of results) {
    const key = groupKey(result);
    const members = groups.get(key);
    if (members) members.push(result);
    else groups.set(key, [result]);
  }

  const merged = [...groups.values()].map((members): CollapsedWork => {
    // Ties go to the first member in provider order.
    const representative = members.reduce((best, m) =>
      m.editionCount > best.editionCount ? m : best,
    );
    return {
      ...representative,
      coverUrl:
        representative.coverUrl ?? members.find((m) => m.coverUrl !== null)?.coverUrl ?? null,
      editionCount: members.reduce((sum, m) => sum + m.editionCount, 0),
      mergedKeys: members.map((m) => m.olWorkKey),
    };
  });

  const anyPopular = merged.some((m) => effectiveCount(m) > 1);
  if (opts.guardVisible && !anyPopular) return { items: merged, moreMatches: [] };

  return {
    items: merged.filter((m) => effectiveCount(m) > 1),
    moreMatches: merged.filter((m) => effectiveCount(m) <= 1),
  };
}
