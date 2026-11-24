import type { WorkSearchResult } from '../../../infra/catalog/catalog-provider.js';

/**
 * Open Library tags series inconsistently: for "The Stormlight Archive" the `series:` subject is
 * on 2 of the 7 books, the `series` search field on 3 others, and the rest only have the series
 * name in related titles. SPEC 18 therefore merges three searches and filters the union.
 * Pure, no Nest or Prisma imports.
 */

/** A work needs at least this many editions to join a series from a text match alone. */
export const MIN_EDITIONS_FOR_TEXT_MATCH = 5;

const PART_OF_A_BOOK = /\bparts?\s+(?:one|two|three|four|five|i{1,3}|\d+)\b/i;
const BUNDLE =
  /\b(?:collection|boxed?\s+set|box\s*set|book\s+set|bundles?|omnibus)\b|\bbooks?\s+\d|\d+\s+books\b/i;

/** Parts of a split book, bundles, box sets and omnibus volumes are not books of the series. */
export const isSeriesJunkTitle = (title: string): boolean =>
  PART_OF_A_BOOK.test(title) || BUNDLE.test(title) || title.includes(' / ');

type Author = { olAuthorKey: string; name: string };

/** The author that appears on most results (ties go to the first seen), or null. */
export function mainAuthor(results: readonly WorkSearchResult[]): Author | null {
  const counts = new Map<string, { author: Author; count: number }>();
  for (const result of results) {
    for (const author of result.authors) {
      const entry = counts.get(author.olAuthorKey);
      if (entry) entry.count += 1;
      else counts.set(author.olAuthorKey, { author, count: 1 });
    }
  }
  let best: { author: Author; count: number } | null = null;
  for (const entry of counts.values()) {
    if (best === null || entry.count > best.count) best = entry;
  }
  return best?.author ?? null;
}

type Candidates = {
  /** Results of the precise subject search. Trusted: they skip the edition threshold. */
  tagged: readonly WorkSearchResult[];
  /** Results of the `series` field search and of the title plus author search. */
  textMatches: readonly WorkSearchResult[];
  /** Key of the main author of the series, or null when it is unknown. */
  authorKey: string | null;
};

/**
 * The works of a series, in the order found, without repeats:
 * - tagged works stay unless their title is junk;
 * - text matches need the main author, enough editions and a title that is not junk.
 */
export function selectSeriesWorks({
  tagged,
  textMatches,
  authorKey,
}: Candidates): WorkSearchResult[] {
  const seen = new Set<string>();
  const selected: WorkSearchResult[] = [];
  const add = (result: WorkSearchResult): void => {
    if (seen.has(result.olWorkKey)) return;
    seen.add(result.olWorkKey);
    selected.push(result);
  };

  for (const result of tagged) {
    if (!isSeriesJunkTitle(result.title)) add(result);
  }
  for (const result of textMatches) {
    const byMainAuthor =
      authorKey !== null && result.authors.some((a) => a.olAuthorKey === authorKey);
    if (
      byMainAuthor &&
      result.editionCount >= MIN_EDITIONS_FOR_TEXT_MATCH &&
      !isSeriesJunkTitle(result.title)
    ) {
      add(result);
    }
  }
  return selected;
}
