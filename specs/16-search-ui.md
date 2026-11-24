# SPEC 16 — Search UI: top-bar quick results, recent searches and results page (M3.4)

> **Status:** Approved
> **Depends on:** SPEC 03, SPEC 05, SPEC 15
> **Date:** 2026-11-24
> **Objective:** Add a top-bar search field with a quick-results dropdown, ⌘K and recent searches, plus the S2 search results page for books with an optional genre filter, reading only `GET /v1/search/books`.

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
- Vitest and Testing Library tests for the helper, hooks, dropdown, page and TopBar.
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

1. Move `useDebouncedValue` to `lib/`, add the `search` query key and `use-search-books.ts` with a unit test (cursor paging, disabled below minimum length, query validation). Verify: `pnpm --filter web test`.
2. Add `recent-searches.ts` and `use-recent-searches.ts` with unit tests (max 8, dedupe, remove, clear, corrupt data, storage unavailable). Verify: `pnpm --filter web test`.
3. Add i18n keys in EN and ES. Verify: the i18n key-parity test.
4. Build `SearchResultRow`, `SearchResultsList` (skeleton, empty, error with retry, Load more) and `SearchPage` with the genre chip, and the `/search` route. Verify: open `/search?q=Pedro Páramo`, see one row per work, open `/search?q=dune&genre=Fiction`, see the chip, remove it.
5. Build `TopBarSearch`, `QuickResults` and `RecentSearches`, then replace the icon link in `TopBar` from 768px up. Verify: type "Pedro", see up to 5 results, press Enter, land on `/search?q=Pedro`.
6. Add `use-search-shortcut.ts` and wire it in `TopBarSearch`. Verify: ⌘K or Ctrl+K focuses the field from any signed-in screen and does not fire inside another text input in a way that steals typing.
7. Component tests for the dropdown (keyboard, combobox attributes, recents), the page states and the TopBar breakpoint behavior. Tick M3.4 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

**Quick results**

- [ ] Focusing an empty top-bar field (from 768px) shows recent searches, or nothing when there are none.
- [ ] Typing 1 character sends no request. Typing 2 or more sends one request after 250 ms of no typing.
- [ ] The dropdown lists at most 5 works with cover, title and authors, and a footer item "See all results".
- [ ] Enter with no active option goes to `/search?q=<text>` and stores the text in recents.
- [ ] Arrow Down and Arrow Up move the active option, Enter on a work goes to `/works/<encoded ref>`, Escape closes the dropdown and keeps the text.
- [ ] Clicking outside closes the dropdown.
- [ ] Ctrl+K (Windows, Linux) and ⌘K (macOS) focus the field and open the dropdown. The shortcut is ignored below 768px.
- [ ] The field has an accessible name, and the combobox attributes in the Data model section are present and update with the active option.

**Recent searches**

- [ ] A submitted search is stored once, newest first. Repeating it with other casing moves it to the top without a duplicate.
- [ ] Only the 8 newest entries are kept.
- [ ] Removing one entry and "Clear all" update the list and localStorage.
- [ ] Corrupt data under `verso:recent-searches:v1` is ignored without an error.
- [ ] With localStorage blocked, search still works and recents last until reload.

**Results page**

- [ ] `/search?q=Pedro Páramo` renders one row per work with title, authors, first publication year and "N editions". Rows without `editionCount` omit that text.
- [ ] A row links to `/works/<encoded ref>`.
- [ ] "Load more" appears only when `nextCursor` is set, fetches the next page and appends rows, and disappears when `nextCursor` is `null`.
- [ ] `/search?q=dune&genre=Fiction` sends `genre=Fiction` and shows a "Fiction" chip. Removing the chip reloads results for `q` only and drops `genre` from the URL.
- [ ] Submitting the page's own field updates `q` in the URL and keeps `genre`.
- [ ] `/search` with no `q` shows a prompt state, sends no request, and the field is focused.
- [ ] `q` over 200 characters or `genre` over 80 characters shows the empty prompt state and sends no request.
- [ ] The page shows "No books match ‘{query}’" with the manual add link when the result is empty.
- [ ] A 503 `CATALOG_UNAVAILABLE` or a 429 shows an error message with a Retry action and keeps the typed query.
- [ ] Rows have no status badge and no "Want to read" button.
- [ ] No tabs, no counts and no Users UI exist.

**Shell**

- [ ] Below 768px the top-bar search icon links to `/search` and opens no dropdown.
- [ ] From 768px the top bar shows the field instead of the icon, and the navigation layout does not jump.

**General**

- [ ] Every string comes from `packages/i18n` and exists in EN and ES (key-parity test passes).
- [ ] No raw hex colors and no emojis. The search and close icons are the only icon-only controls and have an `aria-label`.
- [ ] Every control is reachable with the keyboard, with a visible focus ring. Reduced motion is respected.
- [ ] No test hits the network. Tests use mocked `api` responses.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] M3.4 is ticked in `ROADMAP.md` in the same PR.

### UI states: Top-bar quick results

- [ ] **Normal:** up to 5 works plus the "See all results" item.
- [ ] **Loading:** 3 skeleton rows inside the dropdown. Previous results stay until new ones arrive, with no layout jump.
- [ ] **Empty:** field empty shows recent searches. A query with no match shows "No books match ‘{query}’" and the footer item.
- [ ] **Error:** one line with the message and a Retry action. Enter still opens S2.
- [ ] **Light theme:** legible and token-based.
- [ ] **Dark theme:** legible and token-based.
- [ ] **Mobile:** N/A, the dropdown does not exist below 768px (icon links to `/search`).
- [ ] **Desktop:** works at tablet and desktop widths, the dropdown is no wider than the viewport.

### UI states: S2 Search results

- [ ] **Normal:** rows, optional genre chip, Load more and the manual add link.
- [ ] **Loading:** 6 skeleton rows on first load, and a pending state on the Load more button.
- [ ] **Empty:** no `q` shows a prompt, no match shows the "No books match" message with the manual add link.
- [ ] **Error:** message with Retry, using `ErrorState`. A failed Load more keeps the loaded rows and shows the error under them.
- [ ] **Light theme:** legible and token-based.
- [ ] **Dark theme:** legible and token-based.
- [ ] **Mobile:** no horizontal scroll, touch targets at least 44px, rows stack cover left and text right.
- [ ] **Desktop:** works at tablet and desktop widths, content max 1200px.

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
- **Yes (mine, unconfirmed):** Ctrl+K and ⌘K are both accepted on every platform, and `preventDefault` stops the browser's own handler.
- **Yes (mine, unconfirmed):** the manual add link points to `/books/new` even though S14 does not exist yet. A dead link is preferable to omitting a DESIGN element, and the route name matches ARCHITECTURE's web layout when S14 lands. If ARCHITECTURE uses another path, the implementer must use that one and stop to ask if it disagrees.

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
