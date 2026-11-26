# SPEC 19 — Library tables and reading lifecycle (M4.1)

> **Status:** Approved
> **Depends on:** SPEC 03, SPEC 07, SPEC 14, SPEC 15
> **Date:** 2026-11-26
> **Objective:** Add the `UserBook`, `Reading`, `Tag` and `UserBookTag` tables and a pure, fully unit-tested `ReadingLifecycle` class that decides every status and reading change.

## Why this spec exists

M4.1 is the base of the library. Every later M4 task writes through these tables and this class.

`ARCHITECTURE.md` §6.1 and `DESIGN.md` disagreed in three places. This spec records the decisions and updates the documents.

1. The Add-to-library menu in DESIGN offers Abandoned. §6.1 did not allow adding a book as Abandoned.
2. The status dropdown offers all four statuses. §6.1 lacked several transitions.
3. §6.1 did not say what happens to a reading with sessions when the user moves the book back to Want to read.

SPEC 15 also says that M4.1 fills `libraryStatus`. That moves to M4.2.

## Scope

**In:**

- `BookStatus` and `TagColor` as Zod enums in `packages/shared/src/library.ts`, exported from the package index.
- `apps/web/src/components/verso/types.ts` re-exports both types from `@verso/shared`. `BOOK_STATUS_ORDER` stays in the web app.
- Prisma enums `BookStatus`, `ReadingState`, `InheritableVisibility`, `TagColor`.
- Prisma models `UserBook`, `Reading`, `Tag`, `UserBookTag`.
- Prisma preview feature `partialIndexes` for the one-open-reading index.
- One forward-only migration named `library_tables`, with CHECK constraints added by hand.
- Integration tests for the new tables on real Postgres.
- `ReadingLifecycle` in `apps/api/src/modules/reading/domain/reading-lifecycle.ts`, with unit tests.
- Doc updates: `ARCHITECTURE.md` §5.3 and §6.1, the SPEC 15 note about `libraryStatus`, and `ROADMAP.md` (tick M4.1, add `libraryStatus` to M4.2).

**Out of scope (for future specs):**

- Any repository, service, controller, endpoint or Nest module for library or reading (M4.2, M4.3).
- Filling `libraryStatus` in catalog responses (M4.2).
- Persisting works, editions and authors on add (M4.2).
- The check that `UserBook.editionId` belongs to `UserBook.workId` (M4.2, in the service).
- Validation of dates, such as `startedOn` before `finishedOn` (input schemas in M4.2 and M5.4).
- Tag endpoints, tag name rules and Settings → Tags (M4.5).
- Archive, restore and delete permanently (M4.6).
- `ReadingSession` and the `Progress` value object (M5.1, M5.2).
- `Annotation`, `Note` and `Review` (M6).
- `ProfileFavorite` and `VisibilityResolver`.
- Seed data for library tables.
- Any UI change.

## Data model

### Shared types

`packages/shared/src/library.ts` follows the pattern of `me.ts`: a constant array, a Zod enum and an inferred type.

```ts
BOOK_STATUSES: 'READING' | 'READ' | 'WANT_TO_READ' | 'ABANDONED'
TAG_COLORS: 'WINE' | 'TOBACCO' | 'BRASS' | 'FOREST' | 'NAVY' | 'OXBLOOD' | 'SLATE' | 'SAND'
// bookStatusSchema, BookStatus, tagColorSchema, TagColor
```

### Prisma schema

```prisma
generator client {
  // existing provider and output stay
  previewFeatures = ["partialIndexes"]
}

enum BookStatus            { READING READ WANT_TO_READ ABANDONED }
enum ReadingState          { IN_PROGRESS FINISHED ABANDONED }
enum InheritableVisibility { INHERIT PUBLIC PRIVATE }
enum TagColor              { WINE TOBACCO BRASS FOREST NAVY OXBLOOD SLATE SAND }

model UserBook {
  id                   String                @id
  userId               String
  user                 User                  @relation(fields: [userId], references: [id], onDelete: Cascade)
  workId               String
  work                 Work                  @relation(fields: [workId], references: [id], onDelete: Restrict)
  editionId            String
  edition              Edition               @relation(fields: [editionId], references: [id], onDelete: Restrict)
  status               BookStatus
  rating               Int?
  hiddenFromProfile    Boolean               @default(false)
  annotationVisibility InheritableVisibility @default(INHERIT)
  progressStyle        ProgressStyle?        // null: use User.progressStyle
  archivedAt           DateTime?             @db.Timestamptz(3)
  addedAt              DateTime              @default(now()) @db.Timestamptz(3)
  createdAt            DateTime              @default(now()) @db.Timestamptz(3)
  updatedAt            DateTime              @updatedAt @db.Timestamptz(3)
  readings             Reading[]
  tags                 UserBookTag[]

  @@unique([userId, workId])
  @@index([userId, status])
  @@index([workId])
  @@index([editionId])
}

model Reading {
  id          String       @id
  userBookId  String
  userBook    UserBook     @relation(fields: [userBookId], references: [id], onDelete: Cascade)
  number      Int
  state       ReadingState
  startedOn   DateTime?    @db.Date
  finishedOn  DateTime?    @db.Date
  currentPage Int?
  percentBp   Int          @default(0)
  createdAt   DateTime     @default(now()) @db.Timestamptz(3)
  updatedAt   DateTime     @updatedAt @db.Timestamptz(3)

  @@unique([userBookId, number])
  @@unique([userBookId], where: raw("state = 'IN_PROGRESS'"))
}

model Tag {
  id        String        @id
  userId    String
  user      User          @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String        @db.Citext
  color     TagColor
  createdAt DateTime      @default(now()) @db.Timestamptz(3)
  updatedAt DateTime      @updatedAt @db.Timestamptz(3)
  books     UserBookTag[]

  @@unique([userId, name])
}

model UserBookTag {
  userBookId String
  tagId      String
  userBook   UserBook @relation(fields: [userBookId], references: [id], onDelete: Cascade)
  tag        Tag      @relation(fields: [tagId], references: [id], onDelete: Cascade)

  @@id([userBookId, tagId])
  @@index([tagId])
}
```

`User`, `Work` and `Edition` gain back-relations only. No column on an existing table changes.

CHECK constraints, added by hand to the migration SQL:

- `UserBook.rating` is null or between 0 and 100.
- `Reading.percentBp` is between 0 and 10000.
- `Reading.currentPage` is null or 0 or more.

Ids are UUID v7 strings generated by the app. No `@default` on ids.

### Domain types

These live in `reading-lifecycle.ts`. The file imports only `BookStatus` from `@verso/shared`. It has no Nest or Prisma imports.

```ts
type LocalDate = string; // 'YYYY-MM-DD' in the user's time zone
type ReadingState = 'IN_PROGRESS' | 'FINISHED' | 'ABANDONED';

type ReadingData = {
  number: number;
  state: ReadingState;
  startedOn: LocalDate | null;
  finishedOn: LocalDate | null;
  currentPage: number | null;
  percentBp: number;
};

type ReadingSnapshot = ReadingData & { hasSessions: boolean };
type LibraryState = { status: BookStatus; readings: ReadingSnapshot[] };

type LifecycleChange =
  | { type: 'SET_STATUS'; status: BookStatus }
  | { type: 'CREATE_READING'; reading: ReadingData }
  | { type: 'UPDATE_READING'; number: number; patch: Partial<Omit<ReadingData, 'number'>> }
  | { type: 'DELETE_READING'; number: number };

class ReadingLifecycleError extends Error {
  code: 'INVALID_TRANSITION' | 'INCONSISTENT_STATE';
}
```

Methods of `ReadingLifecycle`. Each returns `LifecycleChange[]`:

- `add(status, today, dates?)`
- `start(state, today)`
- `finish(state, today)`
- `abandon(state)`
- `resume(state)`
- `startOver(state, today)`
- `reread(state, today)`
- `changeStatus(state, target, today)`

The class never mutates its input and never reads the clock. The caller passes `today`. The service applies the changes in order, in one transaction (M4.2, M4.3).

### Lifecycle rules

Terms:

- **Latest reading:** the reading with the highest `number`.
- **New reading:** `number` is the highest existing number plus one, or 1. `currentPage` is null and `percentBp` is 0.
- **Empty reading:** `startedOn` and `finishedOn` are null, `currentPage` is null or 0, `percentBp` is 0 and `hasSessions` is false.

**Add** returns `SET_STATUS` plus these reading changes:

| Added as | Reading changes |
| --- | --- |
| `WANT_TO_READ` | None |
| `READING` | New `IN_PROGRESS` reading, `startedOn` = today |
| `READ` | New `FINISHED` reading, dates from `dates` or null, `percentBp` 10000 |
| `ABANDONED` | New `ABANDONED` reading, no dates |

`add` ignores `dates` for any status other than `READ`.

**Named actions.** Each one is valid from one status only. From any other status it throws `INVALID_TRANSITION`.

| Action | From | To | Reading changes |
| --- | --- | --- | --- |
| `start` | `WANT_TO_READ` | `READING` | New `IN_PROGRESS` reading, `startedOn` = today |
| `finish` | `READING` | `READ` | Open reading becomes `FINISHED`, `finishedOn` = today, `percentBp` 10000. `currentPage` stays |
| `abandon` | `READING` | `ABANDONED` | Open reading becomes `ABANDONED`. Progress and `startedOn` stay |
| `resume` | `ABANDONED` | `READING` | Latest reading becomes `IN_PROGRESS`. Progress and `startedOn` stay |
| `startOver` | `ABANDONED` | `READING` | New `IN_PROGRESS` reading, `startedOn` = today. The old one stays `ABANDONED` |
| `reread` | `READ` | `READING` | New `IN_PROGRESS` reading, `startedOn` = today |

**Status change.** `changeStatus` returns an empty list when the target equals the current status. Otherwise it returns `SET_STATUS` plus these reading changes:

| From | To | Reading changes |
| --- | --- | --- |
| `WANT_TO_READ` | `READING` | Same as `start` |
| `ABANDONED` | `READING` | Same as `resume` |
| `READ` | `READING` | Same as `reread` |
| `READING` | `READ` | Same as `finish` |
| `READING` | `ABANDONED` | Same as `abandon` |
| `READING` | `WANT_TO_READ` | Open reading without sessions is deleted. With sessions it becomes `ABANDONED` |
| `WANT_TO_READ` or `ABANDONED` | `READ` | See "To Read" below |
| `WANT_TO_READ` or `READ` | `ABANDONED` | If the latest reading is `ABANDONED`, none. Otherwise a new `ABANDONED` reading with no dates |
| `READ` or `ABANDONED` | `WANT_TO_READ` | None. History stays |

**To Read** with no open reading. The first matching row wins:

| Condition | Reading changes |
| --- | --- |
| Latest reading is `ABANDONED` and empty, and a `FINISHED` reading exists | Delete the latest reading |
| Status is `WANT_TO_READ` and a `FINISHED` reading exists | None |
| Latest reading is `ABANDONED` | It becomes `FINISHED`, `percentBp` 10000. `finishedOn` stays null. `startedOn` and `currentPage` stay |
| No readings | New `FINISHED` reading with no dates, `percentBp` 10000 |

**Consistency.** Every method except `add` first checks the input state. It throws `INCONSISTENT_STATE` when a rule fails:

- Status `READING` has exactly one `IN_PROGRESS` reading.
- Any other status has no `IN_PROGRESS` reading.
- Status `ABANDONED` has a latest reading in state `ABANDONED`.
- Status `READ` has at least one `FINISHED` reading.

## Implementation plan

1. Add `packages/shared/src/library.ts` and `library.test.ts`, and export it from `index.ts`. Update `apps/web/src/components/verso/types.ts` to re-export the two types. Verify: `pnpm typecheck && pnpm test`.
2. Add the preview feature, the four enums, the four models and the back-relations to `apps/api/prisma/schema.prisma`. Verify the partial index syntax against the Prisma 7 docs. Verify: `pnpm --filter api prisma validate`.
3. Create the migration without applying it (`pnpm db:migrate --create-only --name library_tables`). Add the CHECK constraints. Apply it. Verify: the SQL only creates new objects, and a second `pnpm db:migrate` creates no migration.
4. Add `apps/api/src/infra/prisma/library-schema.integration.test.ts`. Verify: `pnpm --filter api test`.
5. Add `reading-lifecycle.ts` and `reading-lifecycle.test.ts` with `add`, the six named actions, the consistency check and the error class. Write the tests first. Verify: `pnpm --filter api test`.
6. Add `changeStatus` and its tests. Verify: `pnpm --filter api test`.
7. Update `ARCHITECTURE.md` (§5.3 rows for `UserBook`, `Reading` and `Tag`; §6.1 diagram and rules), the SPEC 15 note and `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

Shared types:

- [ ] `bookStatusSchema` accepts the four statuses and rejects any other string.
- [ ] `tagColorSchema` accepts the eight colors and rejects any other string.
- [ ] `apps/web` defines no `BookStatus` or `TagColor` union of its own.

Database:

- [ ] `pnpm db:migrate` applies cleanly on an empty database and on the current dev database.
- [ ] The migration creates four tables and four enums. No column of an existing table changes.
- [ ] A second `pnpm db:migrate` creates no new migration and reports no drift.
- [ ] A second `UserBook` with the same (`userId`, `workId`) fails.
- [ ] A second `IN_PROGRESS` reading for one `UserBook` fails.
- [ ] One `UserBook` holds several `FINISHED` and `ABANDONED` readings plus one `IN_PROGRESS` reading.
- [ ] Two readings with the same (`userBookId`, `number`) fail.
- [ ] One user cannot hold tags named "Favorites" and "favorites". Two users can hold the same name.
- [ ] A duplicate (`userBookId`, `tagId`) fails.
- [ ] `rating` -1 and 101 fail. `rating` 0, 100 and null succeed.
- [ ] `percentBp` -1 and 10001 fail. `currentPage` -1 fails.
- [ ] Deleting a `Work` or an `Edition` that a `UserBook` uses fails.
- [ ] Deleting a `UserBook` deletes its readings and tag links, and keeps the tags and the work.
- [ ] Deleting a `Tag` deletes its links and keeps the books.
- [ ] Deleting a user deletes their `UserBook`, `Reading`, `Tag` and `UserBookTag` rows, and keeps the works.
- [ ] `UserBook` defaults: `hiddenFromProfile` false, `annotationVisibility` INHERIT, `progressStyle` null, `archivedAt` null. `Reading.percentBp` defaults to 0.

Domain:

- [ ] A test covers each of the four statuses in `add`, including `READ` with and without dates.
- [ ] A test covers each named action from its valid status.
- [ ] Each named action throws `INVALID_TRANSITION` from each of the other three statuses.
- [ ] A test covers each of the 16 status pairs in `changeStatus`.
- [ ] A test covers each row of the "To Read" table.
- [ ] `READ` to `ABANDONED` to `READ` leaves the same number of `FINISHED` readings.
- [ ] `READING` to `WANT_TO_READ` deletes a reading without sessions and abandons a reading with sessions.
- [ ] A test covers each consistency rule.
- [ ] New readings get the highest number plus one.
- [ ] No method mutates its input.
- [ ] `reading-lifecycle.ts` imports nothing from `@nestjs/*`, Prisma or the generated client.

Docs and checks:

- [ ] `ARCHITECTURE.md` §6.1 shows add as `ABANDONED`, every status transition and the rules above.
- [ ] `ARCHITECTURE.md` §5.3 mentions the unique reading number, the `citext` tag name and the CHECK constraints.
- [ ] SPEC 15 says that M4.2 fills `libraryStatus` and changes the schema.
- [ ] M4.1 is ticked in `ROADMAP.md`, and the M4.2 line mentions `libraryStatus`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.

UI states: N/A, this spec changes no screen or component behavior. The only web change is a type import.

## Decisions

- **Yes:** a book can be added as Abandoned. DESIGN offers it, so §6.1 changes.
- **Yes:** every status reaches every other status through `changeStatus`. The UI dropdown offers all four.
- **No:** rejecting the transitions that §6.1 lacked. The UI would have to hide options.
- **Yes:** marking a book Read without an open reading records an unknown finish date. The book was probably read in the past, and a fake date would distort stats.
- **No:** a finished reading dated today on every change to Read. Toggling the status would inflate "Read ×N".
- **Yes:** an empty abandoned reading is deleted on the way back to Read. It avoids a false second read.
- **Yes:** `READING` to `WANT_TO_READ` abandons a reading that has sessions. Sessions and streak history survive, and abandoned readings never count in stats.
- **No:** keeping that reading open. A Want to read book must not have an open reading.
- **Yes:** `start` from `WANT_TO_READ` always creates a new reading, as §6.1 already says.
- **Yes:** a new open reading starts today, including add as Reading.
- **Yes:** a wrong-state named action throws, and a same-status change does nothing. Client bugs stay visible, and a repeated selection is harmless.
- **Yes:** the lifecycle sets `percentBp` to 10000 on every finished reading. `currentPage` is left alone because the class does not know the page count.
- **Yes:** an inconsistent input state throws instead of being repaired. Silent repair would hide a service bug.
- **Yes:** `ReadingLifecycle` stays in `reading/domain`. From M4.3 the `library` module calls it through the exported `reading` service.
- **No:** moving the class to `library/domain`. ARCHITECTURE already places it in `reading`.
- **Yes:** changes identify a reading by `number`, which is unique per book. The domain never handles database ids.
- **Yes:** Prisma `partialIndexes` preview feature, so the schema declares the index.
- **No:** a hand-written partial index. The schema would not show it.
- **Yes:** unique (`userBookId`, `number`), restricted deletes for `Work` and `Edition`, `citext` tag names and CHECK constraints. The database guards what the application assumes.
- **No:** a composite foreign key for edition and work. It needs a change to the `Edition` table, so the service checks it in M4.2.
- **Yes:** a new `InheritableVisibility` enum. `AnnotationVisibility` stays two-valued because the user default is never `INHERIT`. M6 reuses the new enum.
- **Yes:** only `BookStatus` and `TagColor` go to `packages/shared`. Other library schemas arrive with their endpoints.
- **Yes:** `libraryStatus` moves to M4.2, which builds the library reads.
- **Yes:** `createdAt` and `updatedAt` on `UserBook`, `Reading` and `Tag`, by the §5.3 convention.

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| `partialIndexes` is a preview feature and may report drift on every migrate | An acceptance criterion checks a second migrate. If it fails, stop and ask before switching to raw SQL |
| Prisma does not track CHECK constraints | Integration tests fail if a later migration drops one |
| The restricted deletes break test cleanup that removes all works | Tests delete only the rows they create, in dependency order |
| A later screen needs a transition rule that differs | The rules live in one pure class with tests |

## What is **not** in this spec

- Endpoints, services, repositories or Nest modules.
- `libraryStatus`, add to library and lazy persistence.
- Tag management, archive and delete.
- Sessions, progress, annotations, notes and reviews.
- Any UI change.
