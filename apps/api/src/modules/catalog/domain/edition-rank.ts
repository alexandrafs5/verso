/** The fields of an edition that tell a complete entry from a stub. */
export type RankableEdition = {
  coverUrl: string | null;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  publishYear: number | null;
  language: string | null;
  pageCount: number | null;
};

/**
 * Open Library lists editions in no useful order and has no popularity data, so well-described
 * editions go first: a cover weighs most, then an ISBN, then the other fields. Editions with
 * the same score keep the provider order (the sort is stable). Pure, no Nest or Prisma.
 */
export function editionScore(edition: RankableEdition): number {
  return (
    (edition.coverUrl ? 4 : 0) +
    (edition.isbn13 || edition.isbn10 ? 2 : 0) +
    (edition.pageCount ? 1 : 0) +
    (edition.publisher ? 1 : 0) +
    (edition.publishYear ? 1 : 0) +
    (edition.language ? 1 : 0)
  );
}

export function rankEditions<T extends RankableEdition>(editions: readonly T[]): T[] {
  return editions
    .map((edition, index) => ({ edition, index, score: editionScore(edition) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.edition);
}
