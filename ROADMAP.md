# Verso — Roadmap

Build order for F1 and F1.5, one task per branch and PR. Each milestone ends with something you can use. Check items off in the PR that completes them.

Screen ids (S1, P2, …) refer to `docs/DESIGN.md`; section numbers (§) refer to `ARCHITECTURE.md`.

---

## F1 — Core web

### M0. Foundations

- [x] **M0.1** Monorepo: pnpm workspaces, Turborepo, `apps/web`, `apps/api`, `packages/shared`, `packages/i18n`, `packages/config` (tsconfig, ESLint, Prettier). §4
- [x] **M0.2** `docker-compose.yml` with Postgres 16 and Mailpit; `.env.example` for both apps. §13
- [x] **M0.3** NestJS skeleton: `/api` prefix, pino logging, helmet, global Zod validation pipe, problem+json filter, `GET /health`. §8 §15
- [x] **M0.4** Prisma setup, first migration (empty), PrismaService, seed script scaffold.
- [x] **M0.5** Next.js skeleton: App Router, `/api/:path*` rewrite to the API, TanStack Query provider, typed `api-client` with waking-state handling and retries. §2
- [x] **M0.6** CI workflow: lint, typecheck, unit, integration (Postgres service), build. §14
- [x] **M0.7** `docs/adr/` with ADR-001 to ADR-010 (short). §16

**Done when:** `pnpm dev` shows a web page that calls `/api/health` through the proxy; CI is green.

### M1. Design system and app shell

- [x] **M1.1** Tokens (`tokens.css`) for light and dark from DESIGN.md; next-themes (system default); fonts (Cormorant Garamond, Inter) via `next/font`.
- [x] **M1.2** shadcn/ui install and restyle: Button, Input, Select, Dialog, Sheet, DropdownMenu, Tabs, Tooltip, Toast, Skeleton, Switch.
- [x] **M1.3** Verso components: BookCover, GeneratedCover, ProgressBar, RatingDisplay, RatingInput, StatusDropdown, AddToLibraryButton, TagChip, LockToggle, EmptyState, ErrorState. Component tests for RatingInput and ProgressBar.
- [x] **M1.4** `Rating` and `GeneratedCover` in `packages/shared` with unit tests. §6
- [x] **M1.5** i18n: next-intl with `packages/i18n` (en, es), locale detection, plural and date formatting.
- [x] **M1.6** Authenticated app shell: top bar (desktop) and bottom tab bar (< 768px), avatar menu, notification bell placeholder, waking-server banner.

**Done when:** a demo page shows every component in light/dark, EN/ES, desktop/mobile.

### M2. Auth and onboarding

- [x] **M2.1** Better Auth in the API (Prisma adapter, email + password, Google), mounted at `/api/auth`; `SessionGuard`, `AdminGuard`, `@CurrentUser()`. §7 §10
- [x] **M2.2** User extensions (username, settings fields, role); `UsernamePolicy` with tests.
- [x] **M2.3** `EmailProvider`: SMTP (Mailpit) locally, Brevo in production; verification and reset emails in EN/ES. §9
- [x] **M2.4** Screens P2: sign in, create account (split layout with rotating public-domain quote), verify email, forgot and reset password.
- [x] **M2.5** P3 onboarding (7 steps; step 7 "Import from Goodreads" links to S15, which ships in M11 — until then the step shows only Skip) + `GET/PATCH /v1/me`, `/v1/me/settings`, username availability, avatar upload (Supabase signed URL, WebP compression).
- [ ] **M2.6** Rate limiting on auth routes; integration tests for sign-up, sign-in, guards.

**Done when:** a new user can register (email or Google), verify, finish onboarding and land on an empty Home.

### M3. Catalog

- [ ] **M3.1** `CatalogProvider` + `OpenLibraryProvider` (search, work, editions, ISBN, author) with `ExternalCache`, User-Agent, timeouts. Fixture-based tests. §7
- [ ] **M3.2** Catalog tables and migration (Work, Edition, Author, WorkAuthor, Genre, WorkGenre, Series). §5.3
- [ ] **M3.3** `GET /v1/search/books`, `/v1/works/{ref}`, `/editions`, `/v1/authors/{ref}`, `/v1/series/{id}`, `/v1/isbn/{isbn}`.
- [ ] **M3.4** Top-bar search with quick results dropdown, ⌘K and recent searches (stored in localStorage); S2 search results page (Books tab), including genre-filtered results from S3 genre chips.
- [ ] **M3.5** S3 work page, S4 edition selector modal, S5 author page, S6 series page.

**Done when:** you can search "Pedro Páramo", see one result, open the work, browse editions and the author.

### M4. Library

- [ ] **M4.1** UserBook (including nullable `progressStyle`, see M5.3), Reading, Tag, UserBookTag tables; `ReadingLifecycle` with full unit tests (state diagram in §6.1).
- [ ] **M4.2** Add to library (persists work + edition + authors lazily); AddToLibraryButton wired everywhere.
- [ ] **M4.3** Status changes and lifecycle endpoints (finish, reread, abandon, resume, start over).
- [ ] **M4.4** S7 library: status tabs with counts, tag chips filter, sort, grid/list, hover overlay.
- [ ] **M4.5** Tags CRUD with colors; Settings → Tags.
- [ ] **M4.6** Archive, restore, delete permanently (dialog from S8); Settings → Data → archived books.

**Done when:** you can add books in any status, organize them with tags, and archive or delete them.

### M5. Reading progress and Home

- [ ] **M5.1** `Progress` value object and `StreakCalculator` with unit tests (time zones, edge days).
- [ ] **M5.2** ReadingSession table; sessions endpoints; `suggestFinish`; edition change converts progress.
- [ ] **M5.3** S9 Log progress modal (pages/percent toggle, date, "+N pages" helper, finish dialog with brass shimmer). The toggle starts on `User.progressStyle` and the last choice is **remembered per book** in `UserBook.progressStyle` (DESIGN S9); a book without a page count is always percentage.
- [ ] **M5.4** S8 book detail: header, Sessions tab, Readings tab (editable dates, "Date unknown"), rating input in user's scale.
- [ ] **M5.5** `GET /v1/home` aggregate + S1 Home: changing greeting, currently reading carousel, streak (7 days), yearly goal, this month, want to read, empty state.
- [ ] **M5.6** `GET /v1/me/goals/{year}` and Settings → Yearly goal (the `YearlyGoal` table and `PUT` already exist from M2.5).

**Done when:** you can read a book in Verso end to end: start, log sessions, see the streak, finish, reread.

### M6. Annotations and reviews

- [ ] **M6.1** Annotation and Note tables; `VisibilityResolver` with unit tests (all inheritance paths).
- [ ] **M6.2** Annotations endpoints; S8 Annotations tab (highlights with brass bar, bookmarks, nested notes, lock toggles, long-note collapse).
- [ ] **M6.3** Book-level privacy menu (hide from profile, annotation visibility).
- [ ] **M6.4** Review table and endpoints; S8 Review tab with required spoiler question for public reviews.
- [ ] **M6.5** Home "Recent highlights" section.

### M7. Stats

- [ ] **M7.1** Stats queries (§6.2) with integration tests on seeded data; per-user cache and invalidation.
- [ ] **M7.2** S10: period selector (year, month, custom range, all time), headline numbers, goal, charts (Recharts with tokens), top authors, genres, records.
- [ ] **M7.3** Reading calendar heatmap.

### M8. Profiles and social

- [ ] **M8.1** Follow and FollowRequest tables; `ProfileAccessPolicy` and `FollowPolicy` with unit tests.
- [ ] **M8.2** Profile endpoints (header, library, reviews, highlights) with access checks + integration tests for every rule.
- [ ] **M8.3** S11 profile (own and others'), four favorites, private-profile view, follow/requested/following button.
- [ ] **M8.4** Followers/following modal, remove follower, pending requests with accept/decline; switching to public accepts pending requests.
- [ ] **M8.5** User search (S2 Users tab and quick results); Settings → Privacy (profile visibility, defaults, hidden books list).
- [ ] **M8.6** Public reviews list on S3 (public profiles only, spoiler-hidden).
- [ ] **M8.7** SSR public profile with Open Graph image.

### M9. Notifications and scheduling

- [ ] **M9.1** pg-boss behind `JobQueue`; `POST /internal/cron/tick` with secret; `cron-tick.yml` workflow. §9
- [ ] **M9.2** Notification table, events from social and imports; S12 dropdown and full page; unread count in the bell.
- [ ] **M9.3** `maintenance.cleanup` job (cache, old notifications, Supabase keep-alive).

### M10. Manual books and admin

- [ ] **M10.1** S14 create manual book (cover upload or generated preview); private + review PENDING.
- [ ] **M10.2** S16 admin queue: approve, reject, merge (single transaction moving all users' data) with integration tests.
- [ ] **M10.3** MANUAL_BOOK_APPROVED notification.

### M11. Goodreads import and export

- [ ] **M11.1** `GoodreadsCsvParser` and `ShelfMapper` with unit tests on real-format fixture CSVs.
- [ ] **M11.2** ImportJob/ImportItem tables; upload + shelf detection + mapping endpoints.
- [ ] **M11.3** `import.goodreads` job (batches, throttling, resumable, NEEDS_REVIEW) + IMPORT_FINISHED notification.
- [ ] **M11.4** S15 screens: instructions, mapping, live progress, summary and review list.
- [ ] **M11.5** Export CSV/JSON (Settings → Data).

### M12. Landing, polish and launch

- [ ] **M12.1** P1 landing (always-dark hero with bookshelf of generated covers, features, preview, why Verso, CTA, footer) + wake-up ping.
- [ ] **M12.2** Settings: all sections complete (S13), delete account.
- [ ] **M12.3** Accessibility pass (keyboard, contrast, screen reader labels) and responsive pass on every screen.
- [ ] **M12.4** Playwright e2e journeys (§12) in CI.
- [ ] **M12.5** Deploy: Neon, Supabase bucket, Brevo sender, Google OAuth, Render (Dockerfile, migrate on start), Vercel; production smoke test.
- [ ] **M12.6** README for recruiters: what it is, screenshots, architecture diagram, how to run, decisions (link ADRs).

**F1 done when:** deployed, used daily by you, CI green, README published.

---

## F1.5 — Mobile as a PWA

- [ ] **P1** Manifest, icons (V monogram), standalone display, safe areas; install banner (Android prompt, iOS instructions).
- [ ] **P2** Serwist service worker: app shell precache, network-first cache for read endpoints, offline fallback page.
- [ ] **P3** Mobile patterns: bottom sheets for modals, Log progress sheet, full-screen annotation editor, swipeable carousel.
- [ ] **P4** Barcode scanner (`@zxing/browser`) in Search with manual ISBN fallback.
- [ ] **P5** Web Push: VAPID keys, subscription endpoints, `push.send` job, service-worker handlers, iOS "install to get notifications" hint.
- [ ] **P6** Daily reminder: settings (on/off, time), `reminders.daily` via cron tick, onboarding optional step.
- [ ] **P7** Vibration on save where supported.

---

## Later phases (outline only — plan in detail when F1.5 ships)

- **F2 Wrapped:** WrappedSnapshot job, favorite highlights, slide viewer, image export (9:16).
- **F3 Feed:** Activity table + writers, Home feed section, likes, comments, notifications.
- **F4 Clubs:** decide chapter-progress model first (ARCHITECTURE §5.4), then clubs, membership, schedule, chapter threads, voting.
- **F5 Recommendations:** Claude API (paid, decide budget), verification against the catalog, weekly batch, feedback.
