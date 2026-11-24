# SPEC 15 — Catalog read endpoints (M3.3)

> **Status:** Implemented
> **Depends on:** SPEC 06, SPEC 13, SPEC 14
> **Date:** 2026-11-24
> **Objective:** Serve search, work, editions, author, series and ISBN lookup under `/api/v1` from the `CatalogProvider` and the catalog tables, with a Zod contract in `packages/shared`.

## Why this spec exists

M3.4 and M3.5 (search UI, work, author and series pages) read only through these endpoints. The contract has to hold when M4 adds `UserBook` and when M3.4 maps genre chips, so fields that cannot be filled yet exist now as nullable. Changing the schema later would break both apps (CLAUDE.md: the shared schema is the contract).

## Scope

**In:**

- Zod schemas and types in `packages/shared/src/catalog.ts`, exported from `index.ts`: `WorkRef`, `AuthorRef`, `SearchBooksQuery`, `WorkSummary`, `WorkDetail`, `EditionDto`, `AuthorDetail`, `SeriesDetail`, `IsbnResult`, and the paginated search response.
- `CatalogModule` in `apps/api/src/modules/catalog/` with controller, service, repository (Prisma reads only) and a pure `domain/catalog-ref.ts`.
- Endpoints, all behind `SessionGuard`:
  - `GET /v1/search/books?q=&genre=&cursor=`
  - `GET /v1/works/{ref}`
  - `GET /v1/works/{ref}/editions?language=`
  - `GET /v1/authors/{ref}`
  - `GET /v1/series/{id}`
  - `GET /v1/isbn/{isbn}`
- Mapping of `CatalogNotFoundError` and `CatalogUnavailableError` to problem+json codes.
- Throttling with the `/v1` throttler in `apps/api/src/common/rate-limit` (ARCHITECTURE §10): search 60/min/user in the existing `search` bucket, and a new `catalogRead` bucket of 120/min/user for the other catalog reads. Plain GETs were unlimited before, so the new bucket is needed.
- ARCHITECTURE §10: list the `catalogRead` bucket.
- Unit tests (refs, cursor, mappers) and integration tests on real Postgres with `InMemoryCatalogProvider`.
- Shared `ErrorCode` entries for the new codes.
- ROADMAP: tick M3.3.

**Out of scope (for future specs):**

- `GET /v1/works/{ref}/reviews` (M8.6) and `GET /v1/search/users` (M8.5).
- Persisting works, editions or authors on read. Reads never write to catalog tables (CLAUDE.md hard rule). Persisting happens on add to library (M4.2).
- The viewer's library status. `UserBook` arrives in M4.1, so `libraryStatus` is always `null` here.
- Genre tables seeding and chip-to-subject mapping (M3.5, moved from M3.4 by SPEC 16). `genre` here is a raw subject string.
- Any series lookup from Open Library. Series is local data.
- Merge redirects. A local work with `mergedIntoId` is returned as is, until M10.2 defines the behavior.
- Any `apps/web` change, `packages/i18n` strings and OpenAPI generation.
- Paging past the first 20 works on the author page.

## Data model

No new tables. Reads `Work`, `Edition`, `Author`, `WorkAuthor`, `Genre`, `WorkGenre` and `Series` (SPEC 14) and the provider types (SPEC 13).

Contract shapes (in `packages/shared/src/catalog.ts`):

```ts
// "ol:OL123W" or a UUID. Authors: "ol:OL123A" or a UUID.
type WorkRef = string;
type AuthorRef = string;

type AuthorLink = { ref: AuthorRef; name: string };

type WorkSummary = {
  ref: WorkRef;
  title: string;
  authors: AuthorLink[];
  firstPublishYear: number | null;
  coverUrl: string | null;
  editionCount: number | null; // null for local works
  libraryStatus: null;         // always null until M4.1
};

type WorkDetail = {
  ref: WorkRef;
  title: string;
  subtitle: string | null;
  description: string | null;
  firstPublishYear: number | null;
  coverUrl: string | null;
  authors: AuthorLink[];
  genres: string[];            // subject or genre names, at most 8
  series: { id: string; name: string; position: number | null } | null;
  source: 'OPEN_LIBRARY' | 'MANUAL';
  libraryStatus: null;
};

type EditionDto = {
  ref: string;                 // UUID or "ol:OL123M"
  title: string;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string | null;
  publishYear: number | null;
  language: string | null;
  pageCount: number | null;
  format: 'PAPERBACK' | 'HARDCOVER' | 'EBOOK' | 'OTHER';
  coverUrl: string | null;
};

type AuthorDetail = {
  ref: AuthorRef;
  name: string;
  bio: string | null;
  birthYear: number | null;
  deathYear: number | null;
  photoUrl: string | null;
  works: WorkSummary[];        // first page, ordered by firstPublishYear asc, nulls last
};

type SeriesDetail = {
  id: string;
  name: string;
  works: (WorkSummary & { position: number | null })[]; // ordered by position asc, nulls last
};

type IsbnResult = { workRef: WorkRef; edition: EditionDto };

type SearchBooksResponse = { items: WorkSummary[]; nextCursor: string | null };
```

Conventions:

- **Refs.** `ol:OL…W` or `ol:OL…A` is an Open Library key. Anything else must be a UUID. A ref that is neither is `400 INVALID_REF`. `domain/catalog-ref.ts` parses refs with no Nest or Prisma imports. Path parameters (`ref`, `isbn`, `id`) are validated there, from the service, and not with `ZodValidationPipe`, so a bad value gets `INVALID_REF` or `INVALID_ISBN` instead of the generic validation code. Query strings use `ZodValidationPipe` and the shared schemas.
- **Resolution.** For an `ol:` ref the service first looks for a local row with that `olWorkKey` or `olAuthorKey`. If found and visible, the response `ref` is the local UUID. Author links inside a provider work payload stay `ol:` refs, even when that author is persisted locally. If not, it calls the provider and returns `ref` as `ol:…`. Nothing is written.
- **Visibility.** A local work with `catalogStatus = PRIVATE` is returned only to its `createdById`. Visibility follows `catalogStatus` and `createdById` only, whatever the `reviewStatus`. For anyone else it is `404 CATALOG_NOT_FOUND`. Search reads only the provider and never local rows, so private works cannot appear in it. This is an access rule and gets tests.
- **Editions source.** `OPEN_LIBRARY` works list editions from the provider (`listEditions`, optional `language`). `MANUAL` works list their `Edition` rows, filtered by `language` if given.
- **Genres on a work.** Provider works map `subjects` to `genres`, first 8. Local works use `WorkGenre` names.
- **Search.** `q` is trimmed, 1 to 200 characters. `genre` is optional, 1 to 80 characters, and the service sends `<q> subject:"<genre>"` to `searchWorks`, with `"` stripped from `genre`. There is no `limit` parameter: a page is the provider page size (20), and slicing it would skip results between pages. Unknown query keys are ignored. The cursor is base64url of `{"p": <next page>}`. `nextCursor` is `null` when the provider returns an empty page. A malformed cursor is `400 INVALID_CURSOR`.
- **Author works.** For an author with `olAuthorKey`, works come from `searchWorks("author_key:<key>", 1)`, sorted by `firstPublishYear` ascending with nulls last. For a local author without a key, works come from `WorkAuthor` and public `Work` rows.
- **Series.** Local only. Works are public ones, ordered by `seriesPosition` (decimal returned as number). An unknown id is `404 CATALOG_NOT_FOUND`. A non-UUID id is `400 INVALID_REF`.
- **ISBN.** Input is normalized as in SPEC 13. A malformed ISBN is `400 INVALID_ISBN`. The provider returning `null`, or an edition with `olWorkKey = null`, is `404 CATALOG_NOT_FOUND`. Otherwise `workRef` follows the resolution rule above.
- **Author names for a work.** The service resolves each `authorKeys` entry with `getAuthor` (cached 30 days) and keeps at most 5 authors. If one lookup fails with `CatalogNotFoundError`, that author is dropped. `CatalogUnavailableError` fails the request.
- **Errors (problem+json).**

| Situation | Status | `code` |
| --- | --- | --- |
| `CatalogNotFoundError`, missing or private local row | 404 | `CATALOG_NOT_FOUND` |
| `CatalogUnavailableError` | 503 | `CATALOG_UNAVAILABLE` |
| Bad ref, series id | 400 | `INVALID_REF` |
| Bad ISBN | 400 | `INVALID_ISBN` |
| Bad cursor | 400 | `INVALID_CURSOR` |
| Bad query params | 400 | existing validation code from the Zod pipe |
| No session | 401 | `UNAUTHENTICATED` |
| Throttled | 429 | `RATE_LIMITED` |

## Implementation plan

1. Add `packages/shared/src/catalog.ts` with the schemas above and export it. Unit test: valid and invalid refs, query limits, shapes parse. Verify: `pnpm --filter shared test`.
2. Add `domain/catalog-ref.ts` (parse ref, normalize ISBN reuse, encode and decode cursor, build `subject:` query) with unit tests, and `catalog.mappers.ts` with a unit test. Verify: `pnpm --filter api test`.
3. Add `CatalogRepository` (Prisma reads: work by id or `olWorkKey`, editions by work, author by id or `olAuthorKey`, works of an author, series with works) and `CatalogModule` importing `CatalogInfraModule`. Integration test the repository on real Postgres. Verify: `pnpm --filter api test`.
4. Add `CatalogService` search and work detail, including author name resolution, visibility rule and error mapping to `ApiException` codes. Unit tests with `InMemoryCatalogProvider` plus integration tests with the repository. Verify: `pnpm --filter api test`.
5. Add editions, author, series and ISBN to the service. Same test split. Verify: `pnpm --filter api test`.
6. Add `CatalogController` with `SessionGuard`, `UserThrottlerGuard`, `ZodValidationPipe` on query strings, the `search` bucket on search and a new `catalogRead` bucket (120/min) on the rest, plus the new `ErrorCode` entries. Wire `CatalogModule` into `AppModule`. Integration tests through HTTP: 401, 400, 404, 503, 429 and happy paths. Verify: `pnpm --filter api test`.
7. Tick M3.3 in `ROADMAP.md` and update ARCHITECTURE §10. Integration tests need Postgres: run `docker compose up -d` first. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

**Search**

- [x] `GET /api/v1/search/books?q=Pedro Páramo` returns `items` with `ref` starting `ol:`, title, authors with names, `firstPublishYear`, `coverUrl`, `editionCount` and `libraryStatus: null`.
- [x] With `genre=Fiction`, the provider receives the query `Pedro Páramo subject:"Fiction"`. A `"` inside `genre` is stripped.
- [x] `nextCursor` is set when the page has items and decodes to the next page. A request with that cursor asks the provider for page 2. An empty provider page gives `nextCursor: null`.
- [x] Empty `q`, `q` over 200 characters and `genre` over 80 characters return 400. A malformed cursor returns `400 INVALID_CURSOR`.
- [x] Search reads only the provider, so private local works never appear in it.

**Work and editions**

- [x] `GET /v1/works/ol:OL…W` for an unpersisted work returns `WorkDetail` with author names, at most 8 genres and `series: null`. No row is written to `Work`, `Author` or `Edition`.
- [x] `GET /v1/works/{uuid}` for a persisted work returns local data with `series` filled when the work has one, and `genres` from `WorkGenre`.
- [x] `GET /v1/works/ol:OL…W` when a local work has that `olWorkKey` returns the local UUID as `ref`.
- [x] A private manual work returns 200 to its creator and `404 CATALOG_NOT_FOUND` to another user.
- [x] `GET /v1/works/{ref}/editions` returns provider editions for an Open Library work. With `language=es` only Spanish editions return. For a manual work it returns its `Edition` rows, filtered by `language` when given.
- [x] A work detail keeps at most 5 authors, drops one that Open Library no longer knows, and fails with 503 on an outage.
- [x] A malformed ref returns `400 INVALID_REF`. An unknown UUID returns `404 CATALOG_NOT_FOUND`.

**Author, series, ISBN**

- [x] `GET /v1/authors/ol:OL…A` returns bio, years, photo and works ordered by `firstPublishYear` ascending, nulls last. The provider receives `author_key:<key>`.
- [x] `GET /v1/authors/{uuid}` returns the local author. Works come from `searchWorks` when it has an `olAuthorKey`, from `WorkAuthor` otherwise.
- [x] `GET /v1/series/{uuid}` returns works ordered by `position` (`1.5` stays `1.5`), without private works. An unknown id returns 404 and a non-UUID returns `400 INVALID_REF`.
- [x] `GET /v1/isbn/{isbn}` with hyphens returns `{ workRef, edition }`. A valid ISBN the provider does not know returns `404 CATALOG_NOT_FOUND`. A malformed ISBN returns `400 INVALID_ISBN`.

**Errors, access, limits**

- [x] Every endpoint returns 401 without a session.
- [x] `CatalogNotFoundError` from the provider returns `404 CATALOG_NOT_FOUND`. `CatalogUnavailableError` returns `503 CATALOG_UNAVAILABLE`. Both as `application/problem+json`.
- [x] The 61st search in a minute by one user returns 429. The 121st other catalog read returns 429. The two buckets are separate: a user throttled on reads can still search.
- [x] No test hits the network.
- [x] `libraryStatus` is `null` in every response that has it.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] M3.3 is ticked in `ROADMAP.md`.

UI states: N/A, this spec touches no screen or component.

## Decisions

- **Yes:** `libraryStatus` and `series` exist now as nullable. M4.1 fills them without changing the schema.
- **No:** omit those fields. It would force a contract change in M4.
- **Yes:** author works through `searchWorks("author_key:…")`. It reuses the cache and fixtures and needs no provider change.
- **No:** `listAuthorWorks` on `CatalogProvider`. More surface for a page that needs only the first 20 works in F1.
- **Yes:** `genre` is a raw subject string, sent as `subject:"…"`. M3.5 owns the chip mapping and the `Genre` seed (SPEC 14). It was assigned to M3.4 when this spec was written, and SPEC 16 moved it.
- **No:** drop `genre` until M3.4. It would change the endpoint contract later.
- **Yes:** cursor pagination for search, with the cursor wrapping the provider page number. It follows the §8 convention.
- **No:** `?page=`. It breaks the convention and the web client would need a special case.
- **Yes:** ISBN returns `{ workRef, edition }`. The scan screen can show the edition and open the work with one call.
- **Yes:** `CATALOG_NOT_FOUND` as 404, `CATALOG_UNAVAILABLE` as 503, `INVALID_REF`, `INVALID_ISBN` and `INVALID_CURSOR` as 400. Not confirmed one by one in Phase 2. These were the preflight proposals and were approved with the spec.
- **Yes:** reads never persist. An `ol:` ref that was persisted earlier resolves to the local UUID, so the web uses one id once a user has added the book.
- **Yes:** private manual works are visible to their creator only, enforced in the service. CLAUDE.md requires access rules on every read.
- **No:** merge redirects. M10.2 defines merging.
- **Yes:** drop an author whose lookup is 404, fail on 503. One bad author key should not hide the whole work, but an outage should show as an outage.
- **No:** a `limit` parameter. The provider page is fixed, and slicing would skip results between pages.
- **Yes:** a new `catalogRead` throttle bucket. Plain GETs had no bucket, so the 120/min read limit needed one.
- **Yes:** path parameters validated in `domain/catalog-ref.ts` through the service, for specific error codes.
- **No:** `GET /v1/works/{ref}/reviews`. It belongs to M8.6 and needs profile visibility.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Work detail costs 1 + N provider calls for authors | At most 5 authors, `getAuthor` cached 30 days |
| `author_key:` search returns only 20 works, so prolific authors look incomplete | Accepted for F1, noted out of scope. Paging can be added later without changing `AuthorDetail` consumers |
| `subject:"…"` with unusual characters changes the Open Library query | `"` is stripped, length is capped, Open Library errors map to `CATALOG_UNAVAILABLE` |
| Local row and `ol:` ref both exist and drift | Local row wins. It is the user's persisted data |
| Throttle limits drift from ARCHITECTURE §10 | Buckets live in `common/rate-limit/rate-limit.ts`. The HTTP test checks both limits |

## What is **not** in this spec

- Reviews, user search, manual book creation and admin.
- `UserBook` and library status.
- Persisting any catalog row on read.
- Genre seed data, chip mapping and any web, i18n or OpenAPI work.
- Author works beyond the first page, merge redirects, Open Library series.
