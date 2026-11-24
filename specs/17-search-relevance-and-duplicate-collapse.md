# SPEC 17 — Search relevance and duplicate collapse (M3.3b)

> **Status:** Approved
> **Depends on:** SPEC 13, SPEC 15, SPEC 16
> **Date:** 2026-11-24
> **Objective:** Merge near-duplicate works inside each result page of `GET /v1/search/books` and fold the 1-edition long tail into a `moreMatches` list that S2 shows behind a "Show more matches" button.

## Why this spec exists

The "Pedro Páramo" fixture (`search-pedro-paramo.json`) shows the problem. Open Library returns the main novel (135 editions), a combined volume of the same author (25), several spellings of the same title, and many 1-edition entries such as study guides and photo books. The user sees them as equal rows. M3.3b fixes this before M3.5, so the work page links from search lead to the right work. SPEC 13, SPEC 15 and SPEC 16 are `Implemented`. This spec adds pointer notes to SPEC 15 and SPEC 16 in the same PR, as SPEC 16 did for SPEC 15. SPEC 13 needs no note, because the provider interface does not change.

**Correction after manual testing (2026-11-24).** The first version also sent `sort=editions` to Open Library to rank by popularity. Live checks showed it sorts every loosely matching doc by edition count, so unrelated popular books ("Ready Reference Treatise", 116 editions, for "pedro paramo") rose above the real match, and the 1-edition tail never appeared. The sort was removed. Results keep the Open Library relevance order, and only merging and folding remain.

## Scope

**In:**

- A pure domain function `collapseSearchResults` in `apps/api/src/modules/catalog/domain/search-collapse.ts` (no Nest or Prisma imports) that merges near-duplicates and splits the fold.
- `SearchBooksResponse` gets a required `moreMatches: WorkSummary[]` in `packages/shared/src/catalog.ts` (additive change, schema first).
- Web: S2 renders `moreMatches` behind one "Show more matches (N)" button at the end of the list. The quick-results dropdown ignores `moreMatches`.
- EN and ES strings for the button, in the `search` namespace of `packages/i18n`.
- Fixture tests with the "pedro paramo" query (existing `search-pedro-paramo.json`).
- Pointer notes in SPEC 15 and SPEC 16, an update to DESIGN S2 and the Open Library bullets and the search row in ARCHITECTURE (§7, §8), and ticking M3.3b in `ROADMAP.md`.

**Out of scope (for future specs):**

- Merging or folding across provider pages, any server state or a cursor that carries seen keys.
- Fuzzy matching (edit distance, transliteration beyond accent stripping) and language-aware ranking.
- Folding in the quick-results dropdown.
- Changing the author works query, series, work or editions endpoints.
- Persisting anything. Merging happens only in the response.
- Merge redirects between local works (M10.2).
- Recording a new fixture from live Open Library. Existing fixtures are used.

## Data model

No database changes. The `CatalogProvider` interface does not change. The API contract and one domain type change.

```ts
// packages/shared/src/catalog.ts
type SearchBooksResponse = {
  items: WorkSummary[];       // main results, Open Library relevance order
  moreMatches: WorkSummary[]; // folded 1-edition tail of this page, same order
  nextCursor: string | null;
};

// apps/api/src/modules/catalog/domain/search-collapse.ts
function collapseSearchResults(
  results: WorkSearchResult[],
  opts: { guardVisible: boolean },
): { items: WorkSearchResult[]; moreMatches: WorkSearchResult[] };
```

Conventions:

- **Provider order.** Open Library returns docs in relevance order. The domain function keeps that order and does not sort again. The search never sends a sort.
- **Normalized title.** NFD with combining marks removed, lowercase. Cut at the first `:` or ` / `. Remove any `(...)` group. Replace every non-letter, non-digit with a space and collapse spaces. Then remove a trailing `de <author name>` or `<author name>` (also after a comma) when the removed text, normalized the same way, equals the name of one of the result's authors.
- **Group key.** `normalized title` + `|` + the normalized name of the first author, or an empty string when the result has no author. A name is normalized like a title (no accents or case, punctuation as spaces), then its words are sorted, so "Reyes, Alfonso" and "Alfonso Reyes" match. The author key is not used, because Open Library often gives one person several keys.
- **Representative.** The member with the most editions. Ties go to the first in provider order. The group sits at the position of its first member in provider order. It keeps the representative's `olWorkKey` (so `ref`), title, authors and `firstPublishYear`. `editionCount` is the sum over the group. `coverUrl` is the representative's, or the first non-null cover in the group.
- **Fold.** After merging, a group with `editionCount <= 1` goes to `moreMatches`. A result with an `editionCount` of 0 counts as 1. Order inside both lists follows provider order.
- **Visible guard.** `guardVisible` is `true` only for the first page (no cursor). When it is `true` and no group has more than 1 edition, nothing folds and every group goes to `items`. On later pages the fold always applies. The first screen therefore never shows only a fold button.
- **Cache.** Provider results are cached for 1 day as mapped provider results (SPEC 13). Merging and folding run after the cache, so a change to these rules never leaves stale pages.
- **Cursor.** Unchanged. `nextCursor` is `null` only when the provider page is empty, and merging does not change that. A page can return fewer than 20 rows in `items` and still have a next page.
- **Count text.** S2 shows the merged `editionCount` as "N editions", as in SPEC 16.

## Implementation plan

1. Add `moreMatches` to `searchBooksResponseSchema` in `packages/shared/src/catalog.ts` with a schema test. Update the web and API code that builds or mocks `SearchBooksResponse` so they compile (`moreMatches: []`). Verify: `pnpm typecheck && pnpm --filter shared test`.
2. Add `domain/search-collapse.ts` with unit tests: accents and case, `:` and `/` subtitle, trailing `, <author>` and `de <author>`, parenthetical series text, different first author name stays apart, same name with different author keys merges, no-author results, representative and count sum, cover fallback, fold threshold, `editionCount` 0, visible guard on and off. Verify: `pnpm --filter api test`.
3. Use it in `CatalogService.searchBooks`: call `collapseSearchResults` with `guardVisible: query.cursor === undefined`, map both lists with `searchResultToSummary`. Update the service and HTTP integration tests (the existing 401 without a session case stays), including the fixture test on `search-pedro-paramo.json` and a page-2 case. Verify: `pnpm --filter api test`.
4. Web data layer: `use-search-books.ts` keeps pages as returned. Add a helper that flattens `items` and `moreMatches` across loaded pages. Update the hook tests. Verify: `pnpm --filter web test`.
5. Web UI: in `SearchResultsList.tsx`, add the fold button after the main rows and the "Load more" button. Add i18n keys EN and ES. The quick-results code keeps reading `items` only. Component tests for expand, collapse, reset on new query, count text and the quick-results case. Verify: `pnpm --filter web test`.
6. Docs: pointer notes in SPEC 15 and 16, DESIGN S2, ARCHITECTURE §7 and §8, tick M3.3b in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`. Integration tests need Postgres: `docker compose up -d`.

## Acceptance criteria

**Collapse**

- [x] On the fixture `search-pedro-paramo.json`, `items` has exactly one entry whose title is "Pedro Páramo" and whose first author key is `OL199285A`, with `editionCount` of at least 160 (135 plus 25 from "Pedro Páramo / El llano en llamas").
- [x] On that fixture in relevance order, `moreMatches` holds only entries with `editionCount <= 1`, is not empty, and `items` has no entry with `editionCount <= 1`.
- [x] Two results with the same normalized title but a different first author name stay separate.
- [x] Two results with the same normalized title and the same author name merge, even when their author keys differ or the name is written "Last, First".
- [x] "Pedro Páramo, Juan Rulfo" with author "Juan Rulfo" merges with "Pedro Páramo". "Pedro Paramo" (no accent) merges too.
- [x] A merged group keeps the representative's `ref`, and its `coverUrl` falls back to a non-null cover in the group.
- [x] On page 1, entries with merged `editionCount <= 1` are in `moreMatches` and not in `items`, when at least one group has more than 1 edition.
- [x] On page 1, when every group has 1 edition, `moreMatches` is empty and all groups are in `items`.
- [x] On a request with a cursor, every group with `editionCount <= 1` is in `moreMatches`, even when `items` ends up empty.
- [x] `items` and `moreMatches` keep provider order. Together they hold every merged group exactly once.
- [x] A page where all results merge into a few groups still returns a non-null `nextCursor`. An empty provider page returns `nextCursor: null`, `items: []` and `moreMatches: []`.
- [x] `libraryStatus` is `null` in both lists. No catalog row is written.

**Web**

- [x] S2 shows a "Show more matches (N)" button after the main rows when the loaded pages hold N > 0 folded works. With N = 0 the button is absent.
- [x] Activating the button shows the folded rows below, using the same row component, and the button's `aria-expanded` is `true`. Activating it again hides them.
- [x] Loading another page adds its folded works to the same button and its count, without a second button.
- [x] Changing `q` or `genre` resets the expanded state.
- [x] The quick-results dropdown lists up to 5 works from `items` only and shows no fold control.
- [x] The button label and count text exist in EN and ES. No string is hardcoded.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] M3.3b is ticked in `ROADMAP.md` in the same PR.
- [x] SPEC 15 and 16 each have a note pointing to this spec for the search change.
- [ ] The S2 page has padding at the top, bottom and sides (`px-4 py-8`), done in a separate `fix:` commit. Manual check in a real browser.

### UI states: S2 search results, fold control

- [x] **Normal:** main rows, then "Show more matches (N)", then "Load more" when `nextCursor` is set.
- [x] **Loading:** the existing skeleton rows. The fold button is not rendered until data arrives, so no layout jump above it.
- [x] **Empty:** no results in `items` and `moreMatches` shows the existing empty state with the manual add link. If only `moreMatches` has entries (a later page), the button still shows.
- [x] **Error:** existing error state and retry. A failed "Load more" keeps the rows and the fold button.
- [x] **Light theme:** the button uses tokens only and is legible.
- [ ] **Dark theme:** the button uses tokens only and is legible.
- [ ] **Mobile:** the button is full width, at least 44 px tall, and there is no horizontal scroll.
- [ ] **Desktop:** the button aligns with the list column and shows a visible focus ring.

### UI states: Top-bar quick results

- [x] **Normal:** up to 5 works from `items`, no fold row.
- [x] **Loading:** unchanged from SPEC 16.
- [x] **Empty:** unchanged from SPEC 16.
- [x] **Error:** unchanged from SPEC 16.
- [x] **Light theme:** N/A, no visual change.
- [x] **Dark theme:** N/A, no visual change.
- [x] **Mobile:** N/A, the dropdown does not exist below 768px.
- [x] **Desktop:** unchanged from SPEC 16.

Layout, contrast, focus ring and reduced motion cannot be measured in jsdom. They are a manual check in a real browser.

## Decisions

- **Yes:** `moreMatches` in the same response next to `items`. One call, and the contract change is additive.
- **No:** a flag on each item. The web would split a flat list and the order rules would blur.
- **No:** a separate endpoint or `include=` parameter. It adds a round trip and more surface.
- **Yes:** collapse and fold per provider page. The cursor stays the Open Library page number, so SPEC 15 holds.
- **No:** cross-page merging. It needs state or a heavier cursor. A duplicate that lands on page 2 stays visible there. Accepted for F1.
- **Yes:** quick results use `items` and no fold. A small popover has no room for a fold, and the best 5 deduplicated works are the useful part.
- **Yes:** new SPEC 17, plus pointer notes in SPEC 15 and 16. Implemented specs keep their history.
- **No:** rewriting SPEC 15 and 16 in place. ROADMAP says "amend" and the notes meet that, without losing what those specs recorded.
- **Yes:** group by normalized title and the normalized name of the first author, representative with the most editions, counts summed. Changed from the author key after manual testing: one person can have several author keys in Open Library, which left duplicates.
- **No:** grouping by author key. It missed duplicates whose author keys differed.
- **No:** title-only grouping. It would merge unrelated books with the same title.
- **No:** keeping only the maximum count. The row would show less than the real total of the merged editions.
- **Yes:** fold at `editionCount <= 1` after merging, as in ROADMAP. A relative threshold needs tuning and is harder to test.
- **Yes (in the approved spec):** the visible guard applies only on the first page. The first screen must never show only a fold button. Later pages always fold, because the user already has results above.
- **Yes (in the approved spec):** the group sits at its first member's position and the list is not re-sorted after summing. The relevance order of Open Library stays intact.
- **Yes (in the approved spec):** the group keeps the representative's `firstPublishYear`. A `min` over members would show a year the shown work may not have.
- **Yes (in the approved spec):** one fold button at the end of the list for all loaded pages, with local expanded state that resets on a new `q` or `genre`.
- **No:** `sort=editions` on the search request. Tried first, then dropped after manual testing (see Why this spec exists). Ranking by popularity belongs in a future spec that scores relevance and popularity together.
- **Yes:** the S2 page wrapper gets `px-4 py-8`. `AppShell` is not mounted in `(app)/layout.tsx` yet, so the page had no margin of its own. Added in a separate `fix:` commit outside this spec's original scope.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Title normalization merges two real different books by the same author, for example "Dune" and "Dune: Messiah" | The subtitle cut applies at `:` and ` / ` only, so "Dune: Messiah" merges into "Dune". Accepted for F1. A work stays reachable through its own `ref` on the author page. Revisit in M3.5 if it shows up |
| A real different book hides in the fold because it has 1 edition | The fold is one click away and nothing is dropped. The count is shown on the button |
| A duplicate that sits on page 2 stays unmerged | Accepted, see Decisions. Per-page scope keeps the cursor simple |
| Relevance order still has loosely matching books near the top | Accepted for F1. Open Library decides relevance. Merging and folding only remove duplicates and the 1-edition tail |
| `moreMatches` required in the schema breaks other code that builds a response | Step 1 updates every builder and mock before anything else, and `pnpm typecheck` catches the rest |

## What is **not** in this spec

- A public `sort` parameter, or any user control over ranking.
- Merging or folding across pages, or any server state.
- Fuzzy matching, transliteration or language-aware ranking.
- A fold in the quick-results dropdown.
- Changes to the author works, series, work, editions or ISBN endpoints.
- Persisting catalog rows, merge redirects between local works, or new live fixtures.
