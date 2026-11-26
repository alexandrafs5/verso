import type { InfiniteData, Query, QueryClient } from '@tanstack/react-query';
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

/**
 * Queries whose data carries a library status. The work editions share the work key prefix and
 * carry none.
 */
function isCatalogView({ queryKey: [scope, kind, , extra] }: Query): boolean {
  if (scope === 'search') return true;
  if (scope !== 'catalog') return false;
  return kind === 'author' || kind === 'series' || (kind === 'work' && extra === undefined);
}

function patchData(query: Query, data: unknown, refs: Set<string>, added: Added): unknown {
  const [scope, kind, id] = query.queryKey;
  if (scope === 'search') {
    const search = data as InfiniteData<SearchBooksResponse>;
    return {
      ...search,
      pages: search.pages.map((page) => ({
        ...page,
        items: patchRows(page.items, refs, added),
        moreMatches: patchRows(page.moreMatches, refs, added),
      })),
    };
  }
  if (kind === 'work') {
    const work = data as WorkDetail;
    return refs.has(work.ref) || refs.has(String(id))
      ? { ...work, libraryStatus: toStatus(added) }
      : work;
  }
  const list = data as AuthorDetail | SeriesDetail;
  return { ...list, works: patchRows(list.works, refs, added) };
}

/** Writes the book into one cached view and leaves it stale for the next visit. */
function patchQuery(client: QueryClient, query: Query, refs: Set<string>, added: Added): void {
  if (query.state.data === undefined) return;
  client.setQueryData(query.queryKey, (data: unknown) =>
    data === undefined ? data : patchData(query, data, refs, added),
  );
  // Writing data marks it fresh, so invalidate after, without a request now.
  void client.invalidateQueries({ queryKey: query.queryKey, exact: true, refetchType: 'none' });
}

/**
 * A request already on its way (for example "Load more") rebuilds its data from before the add
 * and would drop the status. Writes it again when each of those requests ends.
 */
function patchAfterFetch(client: QueryClient, views: Query[], patch: (query: Query) => void): void {
  const pending = new Set(views.filter((query) => query.state.fetchStatus !== 'idle'));
  if (pending.size === 0) return;
  const unsubscribe = client.getQueryCache().subscribe(({ query }) => {
    if (!pending.has(query) || query.state.fetchStatus !== 'idle') return;
    pending.delete(query);
    if (pending.size === 0) unsubscribe();
    patch(query);
  });
}

/**
 * Writes an added book into every cached catalog view, so each screen shows its status without a
 * new request (SPEC 20). `requestedRefs` are the refs the book was shown under before the add.
 */
export function applyAddedBook(client: QueryClient, requestedRefs: string[], added: Added): void {
  const refs = new Set([...requestedRefs, added.workRef]);
  const patch = (query: Query) => patchQuery(client, query, refs, added);
  const views = client.getQueryCache().findAll({ predicate: isCatalogView });
  views.forEach(patch);
  patchAfterFetch(client, views, patch);
}

/** The server knows a status the cache does not: load the catalog views again. */
export function refetchCatalogViews(client: QueryClient): void {
  void client.invalidateQueries({ predicate: isCatalogView });
}
