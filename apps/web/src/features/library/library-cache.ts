import type { InfiniteData, Query, QueryClient, QueryKey } from '@tanstack/react-query';
import type {
  AddToLibraryResponse,
  AuthorDetail,
  SearchBooksResponse,
  SeriesDetail,
  WorkDetail,
  WorkSummary,
} from '@verso/shared';

type Added = AddToLibraryResponse;

const toStatus = ({ userBookId, status, readCount, editionRef }: Added) => ({
  userBookId,
  status,
  readCount,
  editionRef,
});

/** The rows of a list, with the added book linked to its saved work. */
function patchRows<T extends WorkSummary>(rows: T[], refs: Set<string>, added: Added): T[] {
  return rows.map((row) =>
    refs.has(row.ref) ? { ...row, ref: added.workRef, libraryStatus: toStatus(added) } : row,
  );
}

/** The editions list shares the work key prefix and carries no library status. */
const isWorkQuery = (key: QueryKey) => key.length === 3 && key[1] === 'work';

const isCatalogView = ({ queryKey }: Query) =>
  queryKey[0] === 'search' ||
  isWorkQuery(queryKey) ||
  queryKey[1] === 'author' ||
  queryKey[1] === 'series';

/**
 * Writes an added book into every cached catalog view, so each screen shows its status without a
 * new request (SPEC 20). `requestedRefs` are the refs the book was shown under before the add.
 */
export function applyAddedBook(client: QueryClient, requestedRefs: string[], added: Added): void {
  const refs = new Set([...requestedRefs, added.workRef]);

  client.setQueriesData<InfiniteData<SearchBooksResponse>>({ queryKey: ['search'] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: patchRows(page.items, refs, added),
            moreMatches: patchRows(page.moreMatches, refs, added),
          })),
        }
      : data,
  );
  for (const query of client.getQueryCache().findAll({ queryKey: ['catalog', 'work'] })) {
    if (!isWorkQuery(query.queryKey)) continue;
    client.setQueryData<WorkDetail>(query.queryKey, (work) =>
      work && (refs.has(work.ref) || refs.has(String(query.queryKey[2])))
        ? { ...work, libraryStatus: toStatus(added) }
        : work,
    );
  }
  client.setQueriesData<AuthorDetail>({ queryKey: ['catalog', 'author'] }, (author) =>
    author ? { ...author, works: patchRows(author.works, refs, added) } : author,
  );
  client.setQueriesData<SeriesDetail>({ queryKey: ['catalog', 'series'] }, (series) =>
    series ? { ...series, works: patchRows(series.works, refs, added) } : series,
  );

  // Stale for the next visit, but no request now.
  void client.invalidateQueries({ predicate: isCatalogView, refetchType: 'none' });
}

/** The server knows a status the cache does not: load the catalog views again. */
export function refetchCatalogViews(client: QueryClient): void {
  void client.invalidateQueries({ predicate: isCatalogView });
}
