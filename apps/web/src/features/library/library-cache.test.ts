import { QueryClient } from '@tanstack/react-query';
import type { AddToLibraryResponse, WorkSummary } from '@verso/shared';
import { describe, expect, it } from 'vitest';
import { queryKeys } from '@/lib/query-keys';
import { applyAddedBook, refetchCatalogViews } from './library-cache';

const UUID = '0190f0f0-1234-7abc-8def-0123456789ab';
const WORK = '0190f0f0-1234-7abc-8def-0123456789ac';

const added: AddToLibraryResponse = {
  userBookId: UUID,
  workRef: WORK,
  status: 'READ',
  readCount: 1,
  editionRef: 'ol:OL1M',
};
const status = { userBookId: UUID, status: 'READ', readCount: 1, editionRef: 'ol:OL1M' };

const row = (ref: string): WorkSummary => ({
  ref,
  title: ref,
  authors: [],
  firstPublishYear: null,
  coverUrl: null,
  editionCount: 1,
  libraryStatus: null,
});

function seeded() {
  const client = new QueryClient();
  client.setQueryData(queryKeys.searchBooks('q'), {
    pages: [{ items: [row('ol:OL1W'), row('ol:OL2W')], moreMatches: [row('ol:OL1W')] }],
    pageParams: [undefined],
  });
  client.setQueryData(queryKeys.work('ol:OL1W'), { ref: 'ol:OL1W', libraryStatus: null });
  client.setQueryData(queryKeys.work('ol:OL2W'), { ref: 'ol:OL2W', libraryStatus: null });
  client.setQueryData(queryKeys.workEditions('ol:OL1W'), [{ ref: 'ol:OL1M' }]);
  client.setQueryData(queryKeys.author('ol:OL1A'), { works: [row('ol:OL1W')] });
  client.setQueryData(queryKeys.series('ol:Saga'), { works: [row('ol:OL1W')] });
  client.setQueryData(queryKeys.me, { id: 'u1' });
  return client;
}

describe('applyAddedBook', () => {
  it('fills the status and links list rows to the saved work', () => {
    const client = seeded();

    applyAddedBook(client, ['ol:OL1W'], added);

    const patched = { ref: WORK, libraryStatus: status };
    expect(client.getQueryData(queryKeys.searchBooks('q'))).toMatchObject({
      pages: [
        {
          items: [patched, { ref: 'ol:OL2W', libraryStatus: null }],
          moreMatches: [patched],
        },
      ],
    });
    expect(client.getQueryData(queryKeys.author('ol:OL1A'))).toMatchObject({ works: [patched] });
    expect(client.getQueryData(queryKeys.series('ol:Saga'))).toMatchObject({ works: [patched] });
  });

  it('fills the work page under any ref of the book, and leaves the rest', () => {
    const client = seeded();

    // The work page asked with the local id, and it is cached under the route ref.
    applyAddedBook(client, [WORK, 'ol:OL1W'], added);

    expect(client.getQueryData(queryKeys.work('ol:OL1W'))).toEqual({
      ref: 'ol:OL1W',
      libraryStatus: status,
    });
    expect(client.getQueryData(queryKeys.work('ol:OL2W'))).toMatchObject({ libraryStatus: null });
    expect(client.getQueryData(queryKeys.workEditions('ol:OL1W'))).toEqual([{ ref: 'ol:OL1M' }]);
  });

  it('marks the catalog views stale, and nothing else', () => {
    const client = seeded();

    applyAddedBook(client, ['ol:OL1W'], added);

    const invalidated = (key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;
    expect(invalidated(queryKeys.searchBooks('q'))).toBe(true);
    expect(invalidated(queryKeys.work('ol:OL2W'))).toBe(true);
    expect(invalidated(queryKeys.workEditions('ol:OL1W'))).toBe(false);
    expect(invalidated(queryKeys.me)).toBe(false);
  });

  it('refetches the catalog views on request', () => {
    const client = seeded();

    refetchCatalogViews(client);

    expect(client.getQueryState(queryKeys.series('ol:Saga'))?.isInvalidated).toBe(true);
    expect(client.getQueryState(queryKeys.me)?.isInvalidated).toBe(false);
  });
});
