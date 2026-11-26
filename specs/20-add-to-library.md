# SPEC 20 — Add to library (M4.2)

> **Status:** Implemented
> **Depends on:** SPEC 03, SPEC 06, SPEC 12, SPEC 14, SPEC 15, SPEC 16, SPEC 17, SPEC 18, SPEC 19
> **Date:** 2026-11-26
> **Objective:** Let a signed-in user add a book to their library from the search, work, author and series pages, saving the work lazily and showing the library status of each book.

## Why this spec exists

M4.1 added the library tables and `ReadingLifecycle`. Nothing writes to them yet. This spec adds the first write, `POST /v1/library`, and wires it into the four catalog screens.

Saving a book has two side effects that this spec must handle:

1. The catalog read endpoints return the local row once a work is saved. A local row has no cover, no series and only mapped genres, so the work page would lose data.
2. Search, author and series results merge near-duplicate works. The saved work is not always the one a row shows.

`ARCHITECTURE.md` §10 also says that the API checks the `Origin` header on non-GET requests. That check does not exist in the code. This spec adds it before the first library write.

The scope is larger than the usual PR (shared contract, three API modules and four screens). The user chose one spec and one PR. Each implementation step is commitable on its own.

## Scope

**In:**

- A global `Origin` check on non-GET API requests.
- Shared contract: `libraryStatus`, the `POST /v1/library` body and response, five error codes, and `pickDefaultEdition` moved to `packages/shared`.
- `reading` module (service and repository) that applies `ReadingLifecycle.add`.
- `library` module with `POST /v1/library`.
- `LibraryStatusModule` inside `modules/library`, imported by `catalog`.
- Lazy persistence of the work, the chosen edition, up to 5 authors and the mapped genres.
- Edition rules: server default edition, and a check that the edition belongs to the work.
- Optional reading dates in the API, with validation.
- `libraryStatus` in search, work, author and series responses.
- Provider data (cover, genres, series) on top of saved Open Library works.
- Web: the add control on S2, S3 and S6, status badges on S5, "You've read N of M" on S6, and toasts.
- S3 opens on the saved edition.
- EN and ES strings, and tests.
- Doc updates: `ARCHITECTURE.md` §7, §8 and §10, `docs/DESIGN.md` (Add-to-library control, S2, S3, S5, S6), pointer notes in SPEC 15 and SPEC 18, and `ROADMAP.md` (tick M4.2).

**Out of scope (for future specs):**

- Changing the status of a saved book (M4.3). The status dropdown is disabled.
- Saving a new edition for a book that is already in the library (M5).
- Date inputs in the UI (M5.4 edits dates).
- Progress, rating and "Go to my book" on S3 (M5).
- The library screen S7 and `GET /v1/library` (M4.4), and `GET /v1/library/{id}` (M5.4).
- Tags (M4.5). Archive, restore, delete and re-adding an archived book (M4.6).
- Series positions and series stored in the `Series` table. They move to the end of F1 or F1.5.
- Any library control or badge in the top-bar quick results.
- "Add it manually" and manual books (M10).
- An add button on the ISBN lookup. No screen uses it yet.
- Matching a saved duplicate across two search pages.
- Playwright e2e for these screens.

## Data model

No migration. The tables come from SPEC 14 and SPEC 19.

### Shared contract

The ref schemas move from `catalog.ts` to `packages/shared/src/refs.ts`, so `library.ts` and `catalog.ts` do not import each other.

```ts
// packages/shared/src/library.ts
export const libraryStatusSchema = z.object({
  userBookId: z.string().uuid(),
  status: bookStatusSchema,
  readCount: z.number().int().min(0), // FINISHED readings
  editionRef: editionRefSchema,       // the saved edition
});

export const addToLibraryBodySchema = z.object({
  workRef: workRefSchema,
  editionRef: editionRefSchema.optional(),
  status: bookStatusSchema,
  startedOn: /* YYYY-MM-DD */ .optional(),
  finishedOn: /* YYYY-MM-DD */ .optional(),
}); // plus the date rules below

export const addToLibraryResponseSchema = libraryStatusSchema.extend({
  workRef: workRefSchema, // always the local work id
});

// packages/shared/src/catalog.ts
// workSummarySchema and workDetailSchema
libraryStatus: libraryStatusSchema.nullable(),

// packages/shared/src/editions.ts
export function pickDefaultEdition<T extends { isOriginalLanguage: boolean; language: string | null }>(
  editions: readonly T[],
  locale: string,
): T | null; // original language, else locale, else first
```

New error codes in `packages/shared/src/problem.ts`:

| Code | Status | When |
| --- | --- | --- |
| `BOOK_ALREADY_IN_LIBRARY` | 409 | The user has a `UserBook` for the work, archived or not |
| `NO_EDITION_AVAILABLE` | 422 | No `editionRef` was sent and the work has no edition |
| `EDITION_NOT_IN_WORK` | 422 | The `editionRef` is not an edition of the work |
| `READING_DATE_IN_FUTURE` | 400 | A date is after today in the user's time zone |
| `ORIGIN_NOT_ALLOWED` | 403 | A non-GET request has a missing or wrong `Origin` |

### `POST /v1/library`

- Guards: `SessionGuard` and `UserThrottlerGuard`. The route uses the `writes` bucket (120 per minute per user).
- Success: `201` with `addToLibraryResponseSchema`.
- Other errors: `401`, `400 VALIDATION_ERROR` (also a malformed `workRef` or `editionRef`, which the body schema rejects), `404 CATALOG_NOT_FOUND`, `429 RATE_LIMITED`, `503 CATALOG_UNAVAILABLE`.

Date rules:

- `startedOn` and `finishedOn` are real calendar dates as `YYYY-MM-DD`, year 0001 or later.
- They are valid only with status `READ`. With another status the request is a `400 VALIDATION_ERROR`.
- Each date is optional on its own.
- `startedOn` is not after `finishedOn` (`400 VALIDATION_ERROR`).
- Neither date is after today in `User.timeZone` (`400 READING_DATE_IN_FUTURE`). The service checks this. "Today" comes from a pure helper in `apps/api/src/modules/reading/domain/local-date.ts`.

### Add flow

1. **Resolve the work.** A local id must exist and be visible to the user, else `404`. An `ol:` ref first looks for a saved row with that `olWorkKey`. A private work of another user is a `404`.
2. **Check for a duplicate.** If the user has a `UserBook` for the saved work, return `409`. Nothing is written.
3. **Choose the edition.** For a work with an `olWorkKey`, the candidates are the provider edition list, ranked by `rankEditions` (at most 100, as today). For a manual work, the candidates are its local editions.
   - With `editionRef`: it must be a candidate, or a saved `Edition` of that work. Else `422 EDITION_NOT_IN_WORK`.
   - Without `editionRef`: `pickDefaultEdition(candidates, User.locale)`. No candidate gives `422 NO_EDITION_AVAILABLE`.
   - If the provider fails and `editionRef` is a saved edition of the work, the add continues. Else `503`.
4. **Save the catalog rows** in one transaction. Existing rows are never overwritten.
   - `Work` by `olWorkKey`: title, subtitle, plain-text description, first publication year, `source` OPEN_LIBRARY, `catalogStatus` PUBLIC.
   - Up to `MAX_AUTHORS` (5) `Author` rows by `olAuthorKey`, with plain-text bio, and `WorkAuthor` positions.
   - `WorkGenre` for each chip of `mapWorkGenres` with a slug. A missing `Genre` row is created from `GENRES`.
   - `Edition` by `olEditionKey`. If its `isbn13` belongs to another saved edition, it is saved with `isbn13` null.
   - A saved `olEditionKey` that belongs to another work gives `422 EDITION_NOT_IN_WORK`.
   - A unique violation from a concurrent add is retried by reading the existing row.
   - No `Series` row is written.
5. **Save the library rows** in a second transaction. `library` inserts the `UserBook` with the requested status and a UUID v7 id. `reading` calls `ReadingLifecycle.add` and inserts the readings with the same transaction client. A unique violation on (`userId`, `workId`) gives `409`.

### Modules

```
apps/api/src/
├─ common/origin/origin.guard.ts
├─ infra/prisma/transaction.ts        type of the transaction client
└─ modules/
   ├─ reading/
   │  ├─ reading.module.ts
   │  ├─ reading.service.ts           addForBook(tx, ...), countFinished(userBookIds)
   │  ├─ reading.repository.ts
   │  └─ domain/local-date.ts
   └─ library/
      ├─ library.module.ts
      ├─ library.controller.ts
      ├─ library.service.ts
      ├─ library.repository.ts
      ├─ library-status.module.ts
      ├─ library-status.service.ts
      └─ library-status.repository.ts
```

Dependency direction, with no cycle:

- `reading` imports no feature module.
- `LibraryStatusModule` imports `ReadingModule`.
- `CatalogModule` imports `LibraryStatusModule`.
- `LibraryModule` imports `CatalogModule` and `ReadingModule`.

`CatalogService` owns catalog persistence and exposes it as one method that returns the local work id, the local edition id and the edition ref.

### Library status in catalog responses

- Applies to `GET /v1/search/books` (`items` and `moreMatches`), `GET /v1/works/{ref}`, `GET /v1/authors/{ref}` and `GET /v1/series/{id}`.
- Only the viewer's own books count. Archived books give `null`.
- `readCount` is the number of FINISHED readings.
- `editionRef` is `ol:<olEditionKey>`, or the local id when the edition has no Open Library key.
- One response uses at most one query for the books and one for the read counts.
- `collapseSearchResults` returns the work keys merged into each row. A row matches when the viewer has any of those works.
- If several match, the shown work wins, else the most recently added one.
- A matched row takes the local id of the saved work as its `ref`. Its title, cover and counts stay as the provider gave them.
- A row without a match keeps its `ref`, even when another user saved the work.
- Local author and series rows match by work id.

### Saved Open Library works

`GET /v1/works/{ref}` builds a saved work with an `olWorkKey` like this:

- Title, subtitle, description, year and authors come from the local row.
- `coverUrl`: provider cover, else the cover of the oldest saved edition that has one, else null.
- `genres`: provider subjects without `series:` subjects (at most 30), else the local genre names.
- `series`: derived from the provider subjects, else the local series, else null.
- If the provider fails, the response uses local data, logs a warning and returns `200`.

Manual works do not change.

### Origin check

- `OriginGuard` is a global guard.
- It applies to every request under `/api` whose method is not `GET`, `HEAD` or `OPTIONS`.
- The `Origin` header must equal the origin of `WEB_ORIGIN`. Else `403 ORIGIN_NOT_ALLOWED`, also when the header is missing.
- `/api/auth/*` keeps the Better Auth check. Routes outside `/api` are not affected.

### Web behavior

- `features/library/use-add-to-library.ts`: the mutation.
- `features/library/LibraryControl.tsx`: wraps `AddToLibraryButton`. Each instance has its own mutation.
- **Not in the library:** a split button. The main part reads "Want to read" and adds with that status. The chevron menu offers the four statuses. The accessible names include the book title, for example "Want to read: Pedro Páramo".
- **Pending:** both parts are disabled and `aria-busy` is set.
- **In the library:** `StatusDropdown`, disabled, showing the status. With `readCount` of 2 or more, "×N" follows it, with a screen-reader text "Read N times".
- The web sends no dates.
- **Success:** toast "Book added to {status}". The response updates the cached search, work, author and series data in place: `libraryStatus` is set and a row `ref` becomes the local work id. Those queries are marked stale without an immediate refetch.
- **Failure:** a toast, and the button works again.

| Failure | Toast (EN) |
| --- | --- |
| `BOOK_ALREADY_IN_LIBRARY` | "This book is already in your library" (catalog queries also refetch) |
| `NO_EDITION_AVAILABLE` | "This book has no edition to add yet" |
| `EDITION_NOT_IN_WORK` | "That edition does not belong to this book. Reload and try again." |
| `CATALOG_NOT_FOUND` | "We could not find this book" |
| `CATALOG_UNAVAILABLE` | "Open Library is not responding. Try again." |
| `RATE_LIMITED` | the existing `common.rateLimited` |
| Anything else | "We could not add the book. Try again." |

- `lib/api-client.ts` does not retry a non-GET request that answers `CATALOG_UNAVAILABLE`.

Per screen:

- **S2:** the control is on every row, also under "Show more matches". From tablet width it sits at the right end of the row. On phones it sits under the book text; below 380px it starts at the row edge so it fits. The row link and the control are siblings. No control is inside a link.
- **S3:** the control sits in the info column, above the edition line. Adding sends the selected edition, or no edition while editions are loading or failed. For a saved book, S3 selects `libraryStatus.editionRef`. The cover changes to that edition's cover only when it is not the default edition, so adding the default edition keeps the work cover (amended after manual testing, 2026-11-26). If the saved edition is not in the list, the default applies. Picking another edition stays local.
- **S5:** a book in the library has a text badge on a corner of its cover: the status, plus "×N" from 2 finished readings. New component `components/verso/StatusBadge.tsx`. The badge is part of the link name.
- **S6:** the same control and layout as S2, starting at the row edge below 420px, where the number column leaves less room. The header shows "You've read N of M". N counts listed works with `readCount` of 1 or more. M counts the listed works. It shows when N is 0, and is hidden when the list is empty.

## Implementation plan

1. Add `OriginGuard`, the `ORIGIN_NOT_ALLOWED` code and its integration tests. Make existing tests send `Origin` on non-GET requests. Verify: `pnpm --filter api test`.
2. Add `refs.ts`, `editions.ts`, the library schemas, the other four error codes and the nullable `libraryStatus`. Point `edition-utils.ts` at the shared `pickDefaultEdition`. The API still returns null. Verify: `pnpm typecheck && pnpm test`.
3. Add `transaction.ts`, `local-date.ts`, and the `reading` module, repository and service, with tests. Verify: `pnpm --filter api test`.
4. Add `LibraryStatusModule`, the merged keys in `collapseSearchResults`, and `libraryStatus` and `ref` rewriting in `CatalogService`. The controller passes the user id. Verify: integration tests with rows inserted by the test.
5. Add the provider data on top of saved Open Library works, with the local fallback. Verify: `pnpm --filter api test`.
6. Add catalog persistence to `CatalogRepository` and `CatalogService`, with integration tests. Verify: `pnpm --filter api test`.
7. Add the `library` module and `POST /v1/library`, with HTTP tests. Verify: `pnpm --filter api test`.
8. Add the mutation, `LibraryControl`, the retry rule, the i18n strings and the toasts, and wire S3 with the saved edition. Verify: add a book on `/works/ol:OL…W` and reload.
9. Wire S2 and S6, with "You've read N of M". Verify: add from both pages.
10. Add `StatusBadge` on S5. Verify: the author of an added book shows the badge.
11. Update the docs and `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

Integration tests need Postgres (`docker compose up -d`). Manual checks need `pnpm dev`, network access to Open Library and an onboarded session.

## Acceptance criteria

Origin:

- [x] A `POST /api/v1/library` or `PATCH /api/v1/me` without `Origin`, or with another origin, returns `403 ORIGIN_NOT_ALLOWED`.
- [x] The same requests with `Origin` equal to `WEB_ORIGIN` pass the check.
- [x] `GET` requests without `Origin` still work, and the auth tests still pass.

Add:

- [x] Adding an `ol:` work returns `201` and creates one `Work`, its `Author` and `WorkAuthor` rows, its mapped `WorkGenre` rows, one `Edition` and one `UserBook`.
- [x] Each status creates the readings that `ReadingLifecycle.add` returns. `WANT_TO_READ` creates none.
- [x] `READING` starts the reading on today's date in the user's time zone, also when it differs from the UTC date.
- [x] `READ` with dates stores them. `READ` without dates stores null dates.
- [x] Dates with another status, or `startedOn` after `finishedOn`, return `400 VALIDATION_ERROR`.
- [x] A future date returns `400 READING_DATE_IN_FUTURE`.
- [x] Without `editionRef`, the saved edition is the original-language one, else the user's language, else the first ranked one.
- [x] An edition of another work returns `422 EDITION_NOT_IN_WORK`.
- [x] A work with no edition returns `422 NO_EDITION_AVAILABLE` and writes nothing.
- [x] A second add of the same work returns `409`, also when the first book is archived.
- [x] Two concurrent adds of one book by one user give one `201` and one `409`, with one row per catalog key.
- [x] Two users adding the same work share one `Work` row.
- [x] An `isbn13` clash saves the edition with `isbn13` null.
- [x] A failed library transaction leaves no `UserBook` and no `Reading`.
- [x] No session returns `401`. Another user's private work returns `404` and writes nothing.
- [x] A provider outage returns `503` and writes nothing, unless the edition is already saved.
- [x] Viewing a search, work, author or series page writes no catalog row.

Library status:

- [x] All four catalog responses carry `libraryStatus` for the viewer's books and null for the rest.
- [x] Another user's book never appears in the viewer's `libraryStatus`.
- [x] An archived book gives null.
- [x] `readCount` counts only FINISHED readings.
- [x] A row that merged a saved duplicate shows its status and has the saved work id as `ref`.
- [x] One search response runs at most two library queries.

Saved works:

- [x] A saved Open Library work still returns its cover, genres and series.
- [x] With the provider failing, a saved work returns `200` with local data.

Web:

- [x] A POST answered with `CATALOG_UNAVAILABLE` is sent once.
- [x] Each failure in the table shows its toast in EN and ES, and the button works again.
- [x] After an add, every cached screen shows the status without a new request.
- [x] The dropdown of a saved book is disabled.
- [x] No button is nested inside a link.
- [x] Add and the status menu work with the keyboard only.
- [x] New UI strings come from `packages/i18n`, and no component uses a raw hex color.

Docs and checks:

- [x] `ARCHITECTURE.md` §7, §8 and §10 match this spec.
- [x] `docs/DESIGN.md` states the disabled dropdown, the S5 badge, the S6 count and the deferred series positions.
- [x] SPEC 15 and SPEC 18 point to this spec.
- [x] M4.2 is ticked in `ROADMAP.md`.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.

### UI states: S2 search results

- [x] **Normal:** every row shows the add control or the disabled status dropdown.
- [x] **Loading:** the existing skeleton matches the row with its control; a pending add disables only that control.
- [x] **Empty:** N/A, the "no results" state does not change.
- [x] **Error:** a failed add shows a toast and re-enables the button.
- [x] **Light theme:** control, disabled status and "×N" are legible and use tokens.
- [x] **Dark theme:** control, disabled status and "×N" are legible and use tokens.
- [x] **Mobile:** the control is under the text, with a 44px target and no horizontal scroll in EN and ES.
- [x] **Desktop:** the control is at the right end of the row (also at tablet width).

### UI states: S3 work page

- [x] **Normal:** the control is above the edition line; a saved book opens on its saved edition; adding without picking an edition keeps the cover and the edition line.
- [x] **Loading:** the skeleton reserves the control space.
- [x] **Empty:** a work with no editions still shows the control, and adding shows the no-edition toast.
- [x] **Error:** an editions error keeps the control usable.
- [x] **Light theme:** legible with tokens.
- [x] **Dark theme:** legible with tokens.
- [x] **Mobile:** no horizontal scroll in EN and ES.
- [x] **Desktop:** the control sits in the info column.

### UI states: S5 author page

- [x] **Normal:** only books in the library show a badge.
- [x] **Loading:** N/A, badges arrive with the works.
- [x] **Empty:** N/A, an empty works list has no covers.
- [x] **Error:** N/A, the badge has no request of its own.
- [x] **Light theme:** the badge is legible on light and dark covers.
- [x] **Dark theme:** the badge is legible on light and dark covers.
- [x] **Mobile:** the longest ES label fits a two-column cover.
- [x] **Desktop:** the badge fits a six-column cover.

### UI states: S6 series page

- [x] **Normal:** the count and a control or status on every row.
- [x] **Loading:** the skeleton matches the new row and header.
- [x] **Empty:** no count and no control.
- [x] **Error:** a failed add shows a toast and re-enables the button.
- [x] **Light theme:** legible with tokens.
- [x] **Dark theme:** legible with tokens.
- [x] **Mobile:** the control is under the text, with no horizontal scroll.
- [x] **Desktop:** the control is at the right end of the row.

## Decisions

- **Yes:** one spec and one PR. Chosen by the user over a split into API and web.
- **Yes:** optional dates in the API for `READ` only, with no date UI. ROADMAP asks for validation, and DESIGN shows no date field.
- **No:** moving date validation to M5.4.
- **Yes:** a server default edition, and `422` for a work with none.
- **No:** a placeholder edition built from the work. It would hold invented data.
- **No:** requiring `editionRef`. Search rows would have to load editions first.
- **Yes:** provider data on top of saved works. No migration, and the data stays fresh.
- **No:** storing cover and series on add.
- **Yes:** a disabled dropdown until M4.3. It keeps the DESIGN shape.
- **No:** pulling status changes into this spec.
- **Yes:** `libraryStatus` is an object with id, status, read count and edition ref.
- **Yes:** `409` for any existing book, archived or not. M4.6 owns restore and re-adding.
- **No:** an idempotent `200`.
- **Yes:** S5 badges and the S6 count and controls. DESIGN places them in M4, and no other task owns them.
- **No:** series positions and stored series now. Open Library has no positions.
- **Yes:** the `Origin` check is part of this spec, and it rejects a missing header.
- **No:** a separate fix PR, or allowing a missing header.
- **Yes:** S3 sends the selected edition and reopens on the saved one.
- **No:** hiding "Change" for a saved book.
- **No:** library controls in the quick results. DESIGN shows none.
- **Yes:** match every merged work key, and link a matched row to the saved work. It avoids a second copy of one book.
- **Yes:** disabled dropdown plus "×N" on rows.
- **No:** a badge next to the dropdown. It repeats the status.
- **Yes:** "You've read N of M" counts finished readings, so a reread in progress still counts.
- **Yes:** toasts without an optimistic update. A cold server could roll back a minute later.
- **Yes:** save an `isbn13` clash as null. The user gets the edition they picked.
- **Yes:** a small `LibraryStatusModule`.
- **No:** a response interceptor or `forwardRef`.
- **Yes:** the `POST` response holds only id, work ref and status data. The book detail belongs to M5.4.
- **Yes:** two transactions, catalog then library. Catalog rows are shared and safe to keep.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| The library transaction fails after the catalog rows are saved | The rows are shared and a retry reuses them. They exist because a user added the book |
| A saved duplicate is on another provider page, or is filtered out before merging (junk title, too few editions) | The row shows "Add". A second copy is possible and accepted |
| The S3 page of the shown duplicate is opened by URL | Matched rows link to the saved work. A direct URL can still show "Add" |
| A chosen edition is not among the first 100 provider editions | Only listed editions can be picked. A saved edition of the work is also accepted |
| A saved work page now calls the provider | Responses are cached for 30 days, and a failure falls back to local data |
| A proxy retry repeats a POST that already succeeded | The second request gets `409`, and the screen refetches the status |
| The `Origin` check blocks the web app behind the proxy | Integration tests and a manual check through the Next.js rewrite. `WEB_ORIGIN` already drives Better Auth |
| A preview deployment has another origin | Better Auth already rejects it. `WEB_ORIGIN` stays the single source |

## What is **not** in this spec

- Status changes, lifecycle actions and edition changes.
- The library screen, book detail, tags, archive and delete.
- Progress, sessions, rating and reviews.
- Date inputs.
- Series positions and stored series.
- Manual books and quick-result controls.
