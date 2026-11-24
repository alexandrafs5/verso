# SPEC 16 — Search UI: top-bar quick results, recent searches and results page (M3.4)

> **Status:** Implemented
> **Depends on:** SPEC 03, SPEC 05, SPEC 15
> **Date:** 2026-11-24
> **Objective:** Add a top-bar search field with a quick-results dropdown, ⌘K and recent searches, plus the S2 search results page for books with an optional genre filter, reading only `GET /v1/search/books`.
> **Amended by SPEC 17:** S2 shows the response `moreMatches` behind one "Show more matches" button after the rows. The quick-results dropdown still lists `items` only.

## Why this spec exists

DESIGN describes search with Books and Users groups, row quick actions and tab counts. Those parts depend on later phases (user search M8.5, library M4, no total count in the API). This spec records what is built now and what is deliberately cut, so M8.5 and M4.2 can add them without reworking this UI.

## Scope

**In:**

- Route `apps/web/src/app/(app)/search/page.tsx` (S2), reading `q` and `genre` from the query string.
- `apps/web/src/features/search/`:
  - `use-search-books.ts`: TanStack Query infinite query on `GET /v1/search/books` through `lib/api-client.ts`, using `nextCursor`.
  - `recent-searches.ts` and `use-recent-searches.ts`: localStorage helper and hook.
  - `SearchPage.tsx`, `SearchResultRow.tsx`, `SearchResultsList.tsx` (list, skeleton, empty, error).
  - `TopBarSearch.tsx` (desktop field and dropdown), `QuickResults.tsx`, `RecentSearches.tsx`.
  - `use-search-shortcut.ts` (⌘K / Ctrl+K).
- Change `apps/web/src/components/shell/TopBar.tsx`: from 768px up, the search icon link becomes `TopBarSearch`. Below 768px it stays the icon link to `/search`.
- Move `useDebouncedValue` from `features/onboarding/use-debounced-value.ts` to `apps/web/src/lib/use-debounced-value.ts` and update its imports.
- Add `search` keys to `lib/query-keys.ts`.
- Quick-results dropdown: opens on focus. With an empty field it shows recent searches. With 2 or more characters (after a 250 ms debounce) it shows up to 5 works and a footer item "See all results". Enter opens `/search?q=…`. Rows open the work page.
- Recent searches: saved on Enter and on "See all results", maximum 8, newest first, case-insensitive dedupe, per-item remove and "Clear all".
- S2 page: query field at top, heading "Books", list rows (cover, title, authors, first publication year, "N editions"), "Load more" button, link "Can't find your book? Add it manually".
- Genre filter: `?genre=` shows a removable chip above the results. Removing it keeps `q`. The value is the raw subject string sent to the API.
- EN and ES strings under a new `search` namespace in `packages/i18n/src/messages/{en,es}.json`, plus a few `shell` keys if needed.
- Vitest and Testing Library tests for the helper, hooks, dropdown, page, TopBar and the shortcut (`use-search-shortcut.test.tsx`).
- Accessibility structure: the dropdown `listbox` holds only `option` elements. Status text, Retry and the recents Clear all and remove buttons sit outside it. The results page announces the loaded count through a single `role="status"` line, not a live region over the whole list.
- DESIGN.md (Search behavior and S2) and the ROADMAP M3.4 and M3.5 lines are updated in this PR, and the three lines in SPEC 15 that name M3.4 as owner of the genre chip mapping are corrected (see Decisions).
- Tick M3.4 in `ROADMAP.md`.

**Out of scope (for future specs):**

- Users group, Users tab, `GET /v1/search/users` (M8.5). No tabs and no counts here.
- "Want to read" split button and library status badge on rows (M4.2). `libraryStatus` stays unused.
- Genre chips on the work page and the chip-to-subject mapping (M3.5). This spec only reads `?genre=`.
- The work page itself (M3.5). Links to `/works/{ref}` lead to a 404 until M3.5.
- Manual add screen S14. The link target `/books/new` does not exist yet.
- Barcode scan and the mobile Search tab with segments (mobile PWA task).
- Dropdown on mobile. Below 768px the icon links to `/search`.
- Infinite scroll, search history synced to the server, search analytics.
- Playwright e2e (no e2e setup for these screens yet).

## Data model

No database or API changes. New code-level contracts:

```ts
// apps/web/src/features/search/recent-searches.ts
// localStorage key: 'verso:recent-searches:v1'
// value: JSON string[] (newest first, max 8, each trimmed, 2..200 chars)

// URL contract for S2
// /search?q=<text>&genre=<subject>
// q: 1..200 chars (SEARCH_QUERY_MAX), genre: 1..80 chars (GENRE_MAX), both from @verso/shared

// apps/web/src/lib/query-keys.ts
searchBooks: (q: string, genre?: string) => ['search', 'books', q, genre ?? null] as const,
```

Conventions:

- Types come from `packages/shared/src/catalog.ts` (`WorkSummary`, `SearchBooksResponse`, `SearchBooksQuery`). The query is validated with `searchBooksQuerySchema` before the request. No schema change.
- Work links use `/works/${encodeURIComponent(ref)}`, because refs can contain `:` (`ol:OL123W`).
- localStorage reads and writes are wrapped in try/catch. Invalid or oversized stored data is ignored and replaced. Without storage, recents live in memory for the session.
- Recent searches are per browser, not per user, and are kept on sign-out. Entries are search text only, never results.
- The quick-results query is disabled below 2 characters. The S2 query runs for any `q` of 1 character or more.
- A new debounced value cancels the in-flight dropdown request through the query `signal`.
- Cover alt text comes from i18n. When a work has no `coverUrl`, `BookCover` renders the generated cover.
- The dropdown follows the ARIA combobox pattern: input `role="combobox"` with `aria-expanded`, `aria-controls` and `aria-activedescendant`, list `role="listbox"`, options `role="option"`. Arrow keys move the active option, Enter opens it (or runs the search when none is active), Escape closes and keeps the text.

## Implementation plan

Manual verification in steps 4 to 6 needs the real stack and network: `docker compose up -d`, `pnpm dev`, and access to Open Library. Automated tests mock `fetch` and never use the network.

1. Move `useDebouncedValue` to `lib/`, add the `search` query key and `use-search-books.ts` with a unit test (cursor paging, query validation, and a `minLength` parameter that disables the query below it). Verify: `pnpm --filter web test`.
2. Add `recent-searches.ts` and `use-recent-searches.ts` with unit tests (max 8, dedupe, remove, clear, corrupt data, storage unavailable). Verify: `pnpm --filter web test`.
3. Add i18n keys in EN and ES. Verify: the i18n key-parity test.
4. Build `SearchResultRow`, `SearchResultsList` (skeleton, empty, error with retry, Load more) and `SearchPage` with the genre chip, and the `/search` route. Verify (needs a signed-in, onboarded session): open `/search?q=Pedro Páramo`, see one row per work, open `/search?q=dune&genre=Fiction`, see the chip, remove it.
5. Build `TopBarSearch`, `QuickResults` and `RecentSearches`, then replace the icon link in `TopBar` from 768px up. Verify: type "Pedro", see up to 5 results, press Enter, land on `/search?q=Pedro`.
6. Add `use-search-shortcut.ts` and wire it in `TopBarSearch`. Verify: ⌘K or Ctrl+K focuses the field from any signed-in screen. Pressed inside another text input or textarea it still focuses the search field and no typed character is lost, because the combination has a modifier. Covered by `use-search-shortcut.test.tsx`.
7. Component tests for the dropdown (keyboard, combobox attributes, recents, request abort on a new query), the page states, the genre chip removal and the TopBar breakpoint classes. Layout, contrast, focus ring and reduced motion cannot be measured in jsdom, so they are a manual check in a real browser. Tick M3.4 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

**Quick results**

- [x] Focusing an empty top-bar field (from 768px) shows recent searches, or nothing when there are none.
- [x] Typing 1 character sends no request. Typing 2 or more sends one request after 250 ms of no typing.
- [x] The dropdown lists at most 5 works with cover, title and authors, and a footer item "See all results".
- [x] Enter with no active option goes to `/search?q=<text>` and stores the text in recents.
- [x] Arrow Down and Arrow Up move the active option, Enter on a work goes to `/works/<encoded ref>`, Escape closes the dropdown and keeps the text.
- [x] Clicking outside closes the dropdown.
- [x] Ctrl+K (Windows, Linux) and ⌘K (macOS) focus the field and open the dropdown. The shortcut is ignored below 768px.
- [x] Ctrl+K pressed inside another text input or textarea focuses the search field. The browser's own handler is blocked only when the search field is not already focused.
- [x] The `listbox` contains only `option` elements. Buttons, status text and the error line are outside it, and `aria-controls` points at the listbox.
- [x] The field exposes the shortcut with `aria-keyshortcuts` and a `title`.
- [x] The field has an accessible name, and the combobox attributes in the Data model section are present and update with the active option.

**Recent searches**

- [x] A submitted search is stored once, newest first. Repeating it with other casing moves it to the top without a duplicate.
- [x] Only the 8 newest entries are kept.
- [x] Removing one entry and "Clear all" update the list and localStorage.
- [x] Corrupt data under `verso:recent-searches:v1` is ignored without an error.
- [x] With localStorage blocked, search still works and recents last until reload.

**Results page**

- [x] `/search?q=Pedro Páramo` renders one row per work with title, authors, first publication year and "N editions". Rows without `editionCount` omit that text.
- [x] A row links to `/works/<encoded ref>`.
- [x] "Load more" appears only when `nextCursor` is set, fetches the next page and appends rows, and disappears when `nextCursor` is `null`.
- [x] `/search?q=dune&genre=Fiction` sends `genre=Fiction` and shows a "Fiction" chip. Removing the chip reloads results for `q` only and drops `genre` from the URL.
- [x] Submitting the page's own field updates `q` in the URL and keeps `genre`.
- [x] `/search` with no `q` shows a prompt state, sends no request, and the field is focused.
- [x] `q` over 200 characters or `genre` over 80 characters shows the empty prompt state and sends no request. A blank `genre` counts as no genre.
- [x] The page shows "No books match ‘{query}’" with the manual add link when the result is empty.
- [x] A 503 `CATALOG_UNAVAILABLE` or a 429 shows an error message with a Retry action and keeps the typed query.
- [x] Rows have no status badge and no "Want to read" button.
- [x] No tabs, no counts and no Users UI exist.

**Shell**

- [x] Below 768px the top-bar search icon links to `/search` and opens no dropdown.
- [x] From 768px the top bar shows the field instead of the icon (test on classes). Manual check: the navigation items keep their position when the breakpoint is crossed.

**General**

- [x] Every string comes from `packages/i18n` and exists in EN and ES (key-parity test passes).
- [x] No raw hex colors and no emojis. The search and close icons are the only icon-only controls and have an `aria-label`.
- [x] Every control is reachable with the keyboard (tests). Manual check: the focus ring is visible, and reduced motion stops the skeleton animation.
- [x] No test hits the network. Tests use mocked `api` responses.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] M3.4 is ticked in `ROADMAP.md` in the same PR.

### UI states: Top-bar quick results

- [x] **Normal:** up to 5 works plus the "See all results" item.
- [x] **Loading:** 3 skeleton rows inside the dropdown. Previous results stay until new ones arrive, with no layout jump.
- [x] **Empty:** field empty shows recent searches. A query with no match shows "No books match ‘{query}’" and the footer item.
- [x] **Error:** one line with the message and a Retry action. Enter still opens S2.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** N/A, the dropdown does not exist below 768px (icon links to `/search`).
- [x] **Desktop:** manual check at 768px and at 1280px: the top bar has no horizontal overflow and the dropdown stays inside the viewport.

### UI states: S2 Search results

- [x] **Normal:** rows, optional genre chip, Load more and the manual add link.
- [x] **Loading:** 6 skeleton rows on first load, and a pending state on the Load more button.
- [x] **Empty:** no `q` shows a prompt, no match shows the "No books match" message with the manual add link.
- [x] **Error:** message with Retry, using `ErrorState`. A failed Load more keeps the loaded rows and shows the error under them.
- [x] **Light theme:** legible and token-based.
- [x] **Dark theme:** legible and token-based.
- [x] **Mobile:** no horizontal scroll, touch targets at least 44px, rows stack cover left and text right.
- [x] **Desktop:** manual check at 768px and at 1280px: the page has no horizontal overflow, and content is at most 1200px wide.

## Decisions

- **Yes:** Books only. Chosen by the user. Users search is M8.5 [F2], and CLAUDE.md forbids building later-phase features, even partially.
- **No:** a disabled Users tab. It adds dead UI that M8.5 would have to rework.
- **Yes:** omit the split button and status badge. Chosen by the user. The library does not exist before M4.1, and the `libraryStatus` field is always `null`.
- **Yes:** a "Books" heading instead of tabs. Chosen by the user. The API returns no total, so a count is impossible, and one tab is not a tab set.
- **Yes:** the icon links to `/search` below 768px. Chosen by the user. It matches the current behavior and the mobile Search tab arrives with the PWA task.
- **Yes:** "Load more" button. Chosen by the user. Keyboard friendly, simple, and needs no scroll observer.
- **No:** infinite scroll. Harder to make accessible, and Open Library pages are slow.
- **Yes:** recent searches: max 8, saved on Enter, per-item remove and clear all. Chosen by the user. Key `verso:recent-searches:v1` has a version suffix so the format can change later.
- **Yes:** `?genre=` with a removable chip, raw subject string, no picker. Chosen by the user. S3 chips in M3.5 will link to it, and no mapping exists to build against.
- **Yes:** 250 ms debounce, minimum 2 characters, ARIA combobox, footer "See all results". Chosen by the user. It limits Open Library calls and the throttler budget (60 searches per minute per user).
- **Yes (mine, unconfirmed):** move `useDebouncedValue` to `lib/` instead of importing across features. One shared hook, no cross-feature import.
- **Yes (mine, unconfirmed):** recents are kept on sign-out. They hold only the user's own typed text on their own browser, and clearing them is one click.
- **Yes (mine, unconfirmed):** Ctrl+K and ⌘K are both accepted on every platform. `preventDefault` stops the browser's own handler only when the search field is not already focused, as the Risks table says. The shortcut also works from inside other text inputs, since it needs a modifier key.
- **Yes:** the genre chip mapping and the `Genre` seed move to M3.5, where the S3 chips are built. This supersedes the two lines in SPEC 15 that name M3.4 as their owner, and those lines are corrected in this PR. M3.4 only reads a raw `?genre=` subject.
- **Yes:** the quick-results dropdown has no Users group. DESIGN.md is updated in this PR to tag it as arriving with user search in M8.5, so DESIGN and ROADMAP no longer disagree.
- **Yes (found in review):** a `genre` over 80 characters invalidates the whole input, so the prompt shows and nothing is requested. A blank `genre` is treated as absent.
- **Yes (found in review):** the genre chip remove button is 44px on mobile and 32px from 768px. The results page announces the loaded count in one status line.
- **Yes:** the manual add link points to `/books/new` even though S14 does not exist yet. A dead link is preferable to omitting a DESIGN element,, and ARCHITECTURE.md line 183 lists `books/new/` in the web layout, so the path is confirmed.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Dropdown rows and the manual add link lead to 404 until M3.5 and S14 | Accepted, stated in Scope. The PR description names the dead links |
| Open Library is slow, so the dropdown feels laggy | Skeleton rows, previous results stay on screen, request aborted when the query changes |
| Search throttle (60/min/user) is hit by fast typing | 250 ms debounce, 2-character minimum, aborted requests. A 429 shows the error state |
| ⌘K conflicts with a browser or screen reader shortcut | `preventDefault` only when the field is not already focused. Escape always works. The icon and field remain usable without the shortcut |
| localStorage unavailable or corrupt | try/catch on every access, in-memory fallback, test for both |
| TopBar breakpoint swap changes layout | Tests at both widths, field width fixed so the navigation does not shift |

## What is **not** in this spec

- Users search, Users tab and user results in the dropdown.
- Add-to-library control and library status on rows.
- Work page, edition selector, author and series pages (M3.5).
- Genre chips on the work page, genre mapping or genre tables.
- Manual add screen, barcode scan, mobile Search tab.
- API, schema or database changes.
- Playwright e2e.
