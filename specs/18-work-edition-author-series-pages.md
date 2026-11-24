# SPEC 18 — Work, edition, author and series pages with genre chips (M3.5)

> **Status:** Approved
> **Depends on:** SPEC 03, SPEC 05, SPEC 13, SPEC 14, SPEC 15, SPEC 16, SPEC 17
> **Date:** 2026-11-24
> **Objective:** Build the S3 work page, the S4 edition selector modal, the S5 author page and the S6 series page on the existing catalog read endpoints, plus the S3 genre chips (fixed chip-to-subject mapping and `Genre` seed) that link to a genre-only search.

## Why this spec exists

M3.4 left every work link in search pointing at a 404 and left `?genre=` reading a raw subject string. M3.5 closes the "Done when" of milestone M3: search "Pedro Páramo", open the work, browse editions and the author.

Three DESIGN parts of S3 to S6 depend on later milestones: Add-to-library and the user block (M4, M5), public reviews (M6), and library status or "You've read N of M" (M4). They are left out here, as SPEC 16 did for the same reason. The S4 progress-conversion note needs reading progress (M5) and is also left out.

The scope is larger than the usual one PR (four screens, a seed, one contract amendment). The user chose one spec and one PR over a split into S3 and S4 versus S5 and S6 (see Decisions). The implementation plan keeps every step commitable on its own, so the PR can still be reviewed commit by commit.

## Scope

**In:**

- **Genre mapping.** `packages/shared/src/genres.ts` with a fixed list of 12 genres (`slug`, English `name`, Open Library `subject`) and a helper `mapWorkGenres(rawGenres)`. EN and ES labels in `packages/i18n` under a new `genres` namespace.
- **Genre seed.** `apps/api/prisma/seed-genres.ts` exports `seedGenres(prisma)` (idempotent upsert by `slug`), called from `apps/api/prisma/seed.ts`.
- **Genre-only search (amends SPEC 15 and SPEC 16).** `q` becomes optional in `searchBooksQuerySchema` when `genre` is present. `buildSearchQuery` sends only `subject:"<genre>"` when `q` is empty. S2 runs the request when `genre` is set and `q` is empty.
- **S3 work page** at `apps/web/src/app/(app)/works/[ref]/page.tsx`: cover, title, subtitle, authors linked to S5, series line linked to S6, genre chips, first publication year, page count of the selected edition, synopsis collapsed to 5 lines with "Read more", edition line with "Change".
- **S4 edition selector** as a modal opened from S3: language chips, list of editions, the current one marked "Selected". Selecting is local UI state.
- **S5 author page** at `apps/web/src/app/(app)/authors/[ref]/page.tsx`: photo or initials, name, life years, biography collapsed, works as a cover grid ordered by first publication year.
- **S6 series page** at `apps/web/src/app/(app)/series/[id]/page.tsx`: series name and the ordered list of works.
- Web hooks and TanStack Query keys for work, editions, author and series, through `lib/api-client.ts`.
- EN and ES strings for all new UI (new namespaces `work`, `editions`, `author`, `series`, `genres`).
- Not-found and error handling for the four routes (`CATALOG_NOT_FOUND` 404, `CATALOG_UNAVAILABLE` 503, 429).
- Doc updates: DESIGN.md (S3 to S6 F1 notes, genre-only search), ARCHITECTURE.md (web layout `authors/[ref]`, genre mapping note in §7 or §8), pointer notes in SPEC 15 and SPEC 16, and tick M3.5 in `ROADMAP.md`.
- Tests: unit (genres helper, `buildSearchQuery`, schema), integration (genre-only search, seed idempotency, 400 when neither `q` nor `genre`), component tests for the four screens and the modal.

**Out of scope (for future specs):**

- Add-to-library control, status, progress, user rating and "Go to my book" on S3 (M4, M5).
- Public reviews block and `GET /v1/works/{ref}/reviews` (M6).
- Library status badges on S5 covers and "You've read N of M" on S6 (M4).
- The S4 note "Your progress will be converted…" and persisting the chosen edition (M4, M5).
- Pagination or "Load more" on the author works grid. The endpoint returns one array.
- Any change to the work, editions, author, series or ISBN endpoints, and any schema change besides the `q` rule.
- Creating series for unpersisted works. A series link appears only when `WorkDetail.series` is not null.
- Persisting works, editions or authors on view (CLAUDE.md hard rule).
- Playwright e2e for these screens.

## Data model

One migration is not needed: the `Genre` table already exists (SPEC 14). One shared constant and one query rule change.

```ts
// packages/shared/src/genres.ts
export const GENRES = [
  { slug: 'fiction', name: 'Fiction', subject: 'Fiction' },
  { slug: 'fantasy', name: 'Fantasy', subject: 'Fantasy' },
  { slug: 'science-fiction', name: 'Science fiction', subject: 'Science fiction' },
  { slug: 'mystery', name: 'Mystery', subject: 'Mystery and detective stories' },
  { slug: 'romance', name: 'Romance', subject: 'Romance' },
  { slug: 'historical-fiction', name: 'Historical fiction', subject: 'Historical fiction' },
  { slug: 'horror', name: 'Horror', subject: 'Horror' },
  { slug: 'thriller', name: 'Thriller', subject: 'Thrillers' },
  { slug: 'biography', name: 'Biography', subject: 'Biography' },
  { slug: 'history', name: 'History', subject: 'History' },
  { slug: 'poetry', name: 'Poetry', subject: 'Poetry' },
  { slug: 'philosophy', name: 'Philosophy', subject: 'Philosophy' },
] as const;

export type GenreChip = { slug: string; subject: string }; // label comes from i18n `genres.<slug>`
export function mapWorkGenres(raw: string[]): GenreChip[];

// packages/shared/src/catalog.ts
// q optional, but at least one of q and genre is required
export const searchBooksQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(SEARCH_QUERY_MAX).optional(),
    genre: z.string().trim().min(1).max(GENRE_MAX).optional(),
    cursor: z.string().min(1).max(200).optional(),
  })
  .refine((v) => v.q !== undefined || v.genre !== undefined, { message: 'q or genre is required' });
```

```ts
// apps/web: URL contracts
// /works/<encodeURIComponent(ref)>
// /authors/<encodeURIComponent(ref)>
// /series/<id>
// /search?genre=<subject>            (q may be absent)
```

Conventions:

- **Mapping.** `mapWorkGenres` matches each raw genre string against `subject` or `name`, case-insensitive after trim. It returns the matches in the order of the raw list, without duplicates. Raw strings that match nothing produce no chip. A work with no match shows no genre block. Provider works hold at most 8 raw genres, so at most 8 chips.
- **Chip target.** `/search?genre=<encodeURIComponent(subject)>` with no `q`. The subject string, not the slug, is the contract with S2 (SPEC 16).
- **Seed.** `seedGenres` upserts each `GENRES` entry into `Genre` by `slug`, sets `name` to the English name, and uses the `slug` as `id`. Running it twice leaves 12 rows. `Genre.name` is never shown to the user (UI labels come from i18n).
- **Search with `genre` only.** `buildSearchQuery(undefined, 'Fiction')` returns `subject:"Fiction"`. With `q` it keeps today's `<q> subject:"<genre>"`. A `"` inside `genre` is still stripped. A `genre` that becomes empty after stripping with no `q` is a 400 (`VALIDATION_ERROR`), checked in the service.
- **Selected edition.** S3 fetches `GET /v1/works/{ref}/editions` once, with no `language`. The first edition returned is selected by default. The language chips in S4 are the distinct non-null `language` values of that list, and filtering is done on the client. The `language` query parameter stays unused by the web.
- **Selected edition effect.** The edition line and the page count in the info block follow the selected edition. The cover is the work's `coverUrl` (the one search shows) until the user picks an edition. After that it is the picked edition's `coverUrl`, then the work's `coverUrl`, then the generated cover. The selection is React state, reset when `ref` changes.
- **Edition order.** `GET /v1/works/{ref}/editions` returns provider editions ranked by `rankEditions` (`domain/edition-rank.ts`): a cover scores 4, an ISBN 2, and page count, publisher, year and language 1 each. Ties keep the provider order. Open Library has no popularity data, so this puts well-described editions first and bare stubs last. Local editions keep their order.
- **Edition line.** `Edition: <language> · <publisher> · <year> · <N pages>`, omitting any null part. It is hidden while editions load, or when there are none.
- **Series line.** `Book {position} of {name}` when `position` is not null, else `Part of {name}`. It links to `/series/{id}`. It appears only when `WorkDetail.series` is not null.
- **Author years.** `birthYear–deathYear`, `birthYear–` when only the birth is known, hidden when both are null.
- **Author works order.** Client sort by `firstPublishYear` ascending, `null` last, ties by title (locale-aware). S6 order is `position` ascending, `null` last, ties by title.
- **Photo fallback.** When `photoUrl` is null the page shows the author's initials on the tobacco token (`--tobacco` in `styles/tokens.css`).
- **Synopsis.** Clamped to 5 lines. "Read more" shows only when the text overflows the clamp, and it toggles to "Read less". Same rule for the author biography.
- **Refs.** The route param is URL-decoded once. An invalid ref (400 `INVALID_REF`) and a 404 `CATALOG_NOT_FOUND` both show the not-found state.

## Implementation plan

Manual checks need the real stack: `docker compose up -d`, `pnpm dev`, network access to Open Library and a signed-in, onboarded session. Automated tests use fakes and mocked `fetch`.

1. **Genre mapping and seed.** Add `packages/shared/src/genres.ts` with `mapWorkGenres` and its test, export it from `packages/shared/src/index.ts`. Add `apps/api/prisma/seed-genres.ts`, call it from `seed.ts`, add an integration test (12 rows, second run changes nothing). Verify: `pnpm --filter shared test && pnpm --filter api test`, then `pnpm db:seed` twice.
2. **Genre-only search, API side.** Change `searchBooksQuerySchema` (schema test: `q` only, `genre` only, both, neither), `buildSearchQuery` and its unit tests, and `CatalogService.searchBooks` for the empty-after-strip case. Integration tests: genre-only reaches the fake provider as `subject:"Fiction"`, neither returns 400, `q` alone and both keep today's behavior. Verify: `pnpm --filter api test`.
3. **Genre-only search, web side.** In `SearchPage.tsx` and `use-search-books.ts`, run the request when `genre` is set and `q` is empty, update the prompt rule (prompt only when both are absent), and fix `search-href.ts` so `/search?genre=…` has no empty `q`. Update the tests. Verify: `pnpm --filter web test`, then open `/search?genre=Fiction` and see results with the chip.
4. **Data layer and i18n.** Add query keys and hooks `use-work.ts`, `use-work-editions.ts`, `use-author.ts`, `use-series.ts` (infer types from `@verso/shared`, no schema change), and the EN/ES strings. Verify: hook tests and the i18n key-parity test.
5. **S3 work page with genre chips and the not-found, error and loading states.** Route, `WorkPage.tsx`, `WorkInfo.tsx`, `GenreChips.tsx`, `Synopsis.tsx` (shared clamp component), `EditionLine.tsx`. The "Change" button is hidden until step 6 wires it. Verify: open `/works/ol:OL…W` from a search row, see info, chips and synopsis. A chip leads to `/search?genre=…`.
6. **S4 edition selector.** `EditionSelectorDialog.tsx` using `components/ui/dialog.tsx`: language chips, rows, "Selected" mark, selecting closes the dialog and updates S3. Verify: change the edition and see the line, cover and page count change.
7. **S5 author page.** Route, `AuthorPage.tsx`, `AuthorWorksGrid.tsx`, with the sort rule and the photo fallback. Link author names on S3 and make cover cards link to S3. Verify: from S3 open the author and back to a work.
8. **S6 series page.** Route, `SeriesPage.tsx`, ordered list. Verify with a persisted work that has a series (fixture or seeded row in the integration environment, see Risks).
9. **Docs.** DESIGN.md, ARCHITECTURE.md, pointer notes in SPEC 15 and SPEC 16, tick M3.5. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

**Genres and search**

- [ ] `GENRES` has 12 entries with unique `slug` and unique `subject`. Every `slug` has an EN and an ES label under `genres`.
- [ ] `mapWorkGenres(['fiction', 'Fantasy', 'Zoology', 'FICTION'])` returns `fiction` then `fantasy`, once each, and nothing for `Zoology`.
- [ ] `mapWorkGenres([])` returns `[]`.
- [ ] `seedGenres` creates 12 `Genre` rows and a second run still leaves 12 rows with the same ids.
- [ ] `GET /v1/search/books?genre=Fiction` returns 200 and the provider receives `subject:"Fiction"` with no leading text.
- [ ] `GET /v1/search/books?q=dune&genre=Fiction` still sends `dune subject:"Fiction"`. `?q=dune` alone is unchanged.
- [ ] `GET /v1/search/books` with neither `q` nor `genre` returns 400. A `genre` that is only `"` characters with no `q` returns 400.
- [ ] `/search?genre=Fiction` shows the "Fiction" chip and results, with an empty field. Removing the chip with no `q` leads to the prompt state at `/search`.
- [ ] `/search` with neither `q` nor `genre` still shows the prompt and sends no request.

**S3 work page**

- [ ] `/works/<ref>` for a provider work shows cover, title, subtitle when present, authors, first publication year and synopsis.
- [ ] Each author name links to `/authors/<encoded ref>`.
- [ ] The series line shows only when `series` is not null, reads `Book 2 of …` or `Part of …`, and links to `/series/<id>`.
- [ ] Genre chips show only for genres that map. Each links to `/search?genre=<encoded subject>`. A work with no mapped genre shows no chip block.
- [ ] The synopsis is clamped to 5 lines and "Read more" appears only when the text overflows. A short synopsis has no button.
- [ ] The edition line shows `Edition: <language> · <publisher> · <year> · <N pages>`, omits null parts, and is hidden while editions load or when there are none.
- [ ] The info block page count follows the selected edition. The cover is the work cover until an edition is chosen, then that edition's cover.
- [ ] `GET /v1/works/{ref}/editions` lists an edition with a cover and an ISBN before a bare one, and keeps the provider order for equal scores.
- [ ] No Add-to-library control, status, progress, rating or reviews block renders.
- [ ] A 404 or an invalid ref shows the not-found state. A 503 or 429 shows an error state with Retry.
- [ ] Opening a work writes nothing to `Work`, `Edition` or `Author`.

**S4 edition selector**

- [ ] "Change" opens a modal with focus inside it, Escape and the close button close it, and focus returns to "Change".
- [ ] The modal lists each edition with cover, language, publisher, year, page count, format label and ISBN (13 first, else 10). Null parts are omitted.
- [ ] Language chips list the distinct non-null languages and an "All" chip. Selecting a chip filters the list on the client. The default is "All".
- [ ] The selected edition is marked "Selected". Choosing another closes the modal and updates the edition line, page count and cover on S3.
- [ ] No progress-conversion note is shown, and nothing is persisted.
- [ ] A work with one edition shows that edition marked "Selected" and no language chips.

**S5 author page**

- [ ] `/authors/<ref>` shows photo or initials, name, life years when known, and the biography clamped with "Read more".
- [ ] The works grid is ordered by `firstPublishYear` ascending, `null` last, ties by title. Each card links to `/works/<encoded ref>`.
- [ ] An author with no works shows an empty state.
- [ ] No status badge appears on any cover.
- [ ] A 404 shows the not-found state. A 503 or 429 shows an error state with Retry.

**S6 series page**

- [ ] `/series/<id>` shows the series name and the works ordered by `position` ascending, `null` last, ties by title.
- [ ] Each row shows the number (or no number when `position` is null), cover, title and first publication year, and links to the work.
- [ ] No "You've read N of M" line and no Add-to-library control appear.
- [ ] A 404 or an invalid id shows the not-found state. A 503 or 429 shows an error state with Retry.

**General**

- [ ] Every string comes from `packages/i18n` in EN and ES (key-parity test passes). No raw hex colors, no emojis.
- [ ] Every cover has alt text from i18n. Every control is reachable with the keyboard.
- [ ] Skeleton animation respects reduced motion (manual check).
- [ ] Layout, contrast, focus ring and the 5-line clamp are checked manually in a real browser at 375, 768 and 1280 px, light and dark.
- [ ] No test hits the network.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] M3.5 is ticked in `ROADMAP.md` in the same PR. SPEC 15 and SPEC 16 each have a note pointing here for the genre-only search.
- [ ] ARCHITECTURE.md names the author route as `authors/[ref]`.

### UI states: S3 Work page

- [ ] **Normal:** cover left, info right on desktop, stacked on mobile, with chips, clamped synopsis and edition line.
- [ ] **Loading:** skeleton for cover, title lines and synopsis. The edition line appears when editions arrive, without moving the info block.
- [ ] **Empty:** a work with no synopsis, no genres or no editions omits those blocks without a gap. No synopsis shows no "Read more".
- [ ] **Error:** not-found state for 404 or invalid ref (message and link to search). `ErrorState` with Retry for 503 and 429.
- [ ] **Light theme:** legible, tokens only.
- [ ] **Dark theme:** legible, tokens only.
- [ ] **Mobile:** no horizontal scroll, chips wrap, touch targets at least 44 px.
- [ ] **Desktop:** manual check at 768 and 1280 px, content at most 1200 px wide.

### UI states: S4 Edition selector

- [ ] **Normal:** chips, list, one row marked "Selected".
- [ ] **Loading:** N/A, the editions load on S3 before "Change" is enabled. While they load, "Change" is not shown.
- [ ] **Empty:** N/A, "Change" is hidden when there are no editions. A language filter always has at least one match because chips come from the list.
- [ ] **Error:** N/A, a failed editions request hides the edition line and "Change". The rest of S3 still renders, and a retry is not offered inside the modal.
- [ ] **Light theme:** legible, tokens only.
- [ ] **Dark theme:** legible, tokens only.
- [ ] **Mobile:** the modal fits the viewport and scrolls inside. Rows and chips are at least 44 px tall.
- [ ] **Desktop:** the modal is centered, has a visible focus ring and traps focus.

### UI states: S5 Author page

- [ ] **Normal:** photo or initials, name, years, biography, works grid.
- [ ] **Loading:** skeleton for header and 6 cover placeholders.
- [ ] **Empty:** an author with no works shows "No books found for this author". No bio omits the biography block.
- [ ] **Error:** not-found state for 404. `ErrorState` with Retry for 503 and 429.
- [ ] **Light theme:** legible, tokens only.
- [ ] **Dark theme:** legible, tokens only.
- [ ] **Mobile:** grid of 2 columns, no horizontal scroll.
- [ ] **Desktop:** grid of 4 to 6 columns, content at most 1200 px wide.

### UI states: S6 Series page

- [ ] **Normal:** name and ordered list with number, cover, title and year.
- [ ] **Loading:** skeleton for the heading and 5 rows.
- [ ] **Empty:** a series with no works shows an empty message.
- [ ] **Error:** not-found state for 404 or invalid id. `ErrorState` with Retry for 503 and 429.
- [ ] **Light theme:** legible, tokens only.
- [ ] **Dark theme:** legible, tokens only.
- [ ] **Mobile:** rows stack cover left and text right, no horizontal scroll.
- [ ] **Desktop:** manual check at 768 and 1280 px.

### UI states: S2 Search results (genre-only change)

- [ ] **Normal:** genre chip, empty field, results.
- [ ] **Loading:** unchanged from SPEC 16.
- [ ] **Empty:** a genre with no results shows "No books match ‘{genre}’".
- [ ] **Error:** unchanged from SPEC 16.
- [ ] **Light theme:** N/A, no visual change.
- [ ] **Dark theme:** N/A, no visual change.
- [ ] **Mobile:** N/A, no layout change.
- [ ] **Desktop:** N/A, no layout change.

## Decisions

- **Yes:** one spec and one PR for all of M3.5. Chosen by the user, against the preflight recommendation to split S3 and S4 from S5 and S6. The plan stays in nine commitable steps so review can go commit by commit.
- **No:** two specs. Would keep PRs small, as CLAUDE.md prefers. Discarded by the user.
- **Yes:** S3 omits Add-to-library, user block and reviews. Chosen by the user. No dead UI for M4 and M6 to rework, same precedent as SPEC 16. DESIGN.md gets F1 notes.
- **No:** disabled placeholders or a "No reviews yet" block with no endpoint.
- **Yes:** genre-only search by making `q` optional when `genre` is set. Chosen by the user. This amends SPEC 15 and SPEC 16, which required `q`. A chip then lands on a result list about the genre, with the chip visible and removable.
- **No:** passing the genre name or the work title as `q`. Results would be fuzzy or about the title.
- **Yes:** the mapping is a fixed list in `packages/shared`. Chosen by the user. One source for the API seed and the web chips. Unmapped subjects show no chip.
- **No:** an API-only mapping, which needs a `WorkDetail` schema change. **No:** raw subjects as chips, which contradicts the ROADMAP M3.5 line.
- **Yes:** chip labels come from i18n by `slug`. `Genre.name` is English and never shown.
- **Yes:** the chip links to the subject string, not the slug. S2 and the API already take a raw subject (SPEC 15, SPEC 16).
- **Yes:** `Genre.id` equals the `slug`. The seed is deterministic and idempotent. Revisit if M10 admin tooling needs generated ids.
- **Yes:** edition selection is local UI state. Chosen by the user. There is no `UserBook` before M4, and the progress note belongs to M5.
- **No:** persisting the selection in the URL, or a read-only modal.
- **Yes:** editions load once without `language` and the modal filters on the client. Chips derived from a filtered list would vanish after the first click.
- **Yes:** the S5 grid shows all works, sorted on the client, no badges. Chosen by the user. The endpoint has no cursor and no library status exists yet.
- **Yes:** S6 is built, and S3 links to it only when `series` is not null. Chosen by the user. Series exist only for persisted works (the id is a UUID), so the page may be reachable only after M4. This matches the ROADMAP M3.5 line.
- **No:** deferring S6 to M4.
- **Yes (mine, unconfirmed):** the list of 12 genres, their Open Library subjects and the Spanish labels below. The user reviews them in this Draft. Spanish: Ficción, Fantasía, Ciencia ficción, Misterio, Romance, Ficción histórica, Terror, Suspenso, Biografía, Historia, Poesía, Filosofía.
- **Yes (mine, unconfirmed):** author route is `authors/[ref]`, not `authors/[id]` as ARCHITECTURE.md line 182 says. The API and `authorRefSchema` use `ref`, and refs can contain `:`. ARCHITECTURE.md is corrected in this PR.
- **Yes (mine, unconfirmed):** the first edition returned is the default selection, without a locale preference. Simple and testable. A locale-aware default can come later.
- **Yes (found in manual testing):** provider editions are ranked by completeness in the API, and the work cover stays until the user picks an edition. The first version showed the first edition's cover and details by default, which differed from the search cover and put stubs on top. Amends the "no change to the editions endpoint" line in Scope for ordering only: the contract does not change.
- **No:** ranking by popularity. Open Library editions carry no popularity field.
- **Yes (mine, unconfirmed):** match a raw genre against `subject` or `name`, case-insensitive. Local works store `WorkGenre` names that come from the seeded `Genre.name`.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| An Open Library subject string in `GENRES` returns few or no results | Step 3 manual check opens `/search?genre=<subject>` for all 12 and the list is corrected before merge |
| Most provider works carry subjects that map to no chip, so S3 often has no genres | Accepted for F1. Chips are a navigation aid, and the raw list stays available in `WorkDetail.genres` for a later spec |
| S6 cannot be reached with real data before M4 persists works | Tested with a persisted work in the integration environment and component tests with fixtures. The route is built and the S3 link is conditional |
| Large PR (nine steps, four screens) is harder to review | One commit per step, one task per commit message, PR description lists steps |
| Making `q` optional lets a client send an empty search through an old code path | The schema `refine`, the service empty-after-strip check and the integration test for "neither" cover it |
| A prolific author returns hundreds of works in one response, so the grid is heavy | Accepted for F1. Covers lazy-load. Pagination needs an endpoint change, which is out of scope |
| The 5-line clamp cannot be measured in jsdom | Manual check in a real browser, `Read more` visibility tested through a mocked overflow flag |

## What is **not** in this spec

- Add-to-library, library status, progress, rating and "Go to my book" on S3.
- Public reviews and the reviews endpoint (M6).
- Library status on S5 covers and "You've read N of M" on S6.
- The S4 progress-conversion note and any persisted edition choice.
- Pagination of the author works grid, and any change to catalog endpoints beyond the `q` rule.
- Persisting works, editions or authors on view.
- Users search, manual add screen, mobile Search tab, Playwright e2e.
