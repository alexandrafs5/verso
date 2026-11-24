# Verso — Design Specification

Nov 19, 2026 · @Ale

## Overview

Verso is a personal-first reading platform — "Goodreads done right": a beautiful, quiet place to track what you read, keep what you highlight, and understand how you read. Social features exist but are secondary to the personal library.

**What Verso fixes about Goodreads**

- Ugly, dated, unintuitive interface → Verso is elegant, minimal and calm.
- Search returns hundreds of near-duplicate editions → Verso shows **one result per book (work)**; editions live inside the work and are optional to pick.
- Catalog full of junk entries → Verso only stores editions a real user added, and user-created books stay private until an admin approves them.

**Primary user:** an avid reader who treats reading as a ritual. Small audience (the owner plus friends); portfolio-grade quality.

**Platforms:** one responsive web app (desktop, tablet, mobile), installable on phones as a PWA. No native app.

**Languages:** English and Spanish at launch, chosen from the device/browser language and changeable in Settings. All code and documentation are in English.

### How to use this document

Every screen and feature carries a phase tag. Design everything for visual coherence, but implementation happens phase by phase (e.g. "implement only \[F1\]").

| Tag | Phase | Scope |
| --- | --- | --- |
| \[F1\] | Core web | Auth, catalog, library, progress, annotations, reviews, stats, profiles, follow, Goodreads import, admin, landing |
| \[F1.5\] | Mobile app | PWA: installable, bottom tab bar, barcode scanning, Web Push notifications |
| \[F2\] | Wrapped | Yearly reading recap |
| \[F3\] | Feed | Activity from people you follow, on the Home screen, with likes and comments |
| \[F4\] | Clubs | Reading clubs with voting and per-chapter forum threads |
| \[F5\] | Recommendations | AI book recommendations |
| \[Future\] | Not planned yet | Listed in the last section; do not design in detail |

Every screen must define its **default, loading (skeleton), empty and error states**, in light and dark mode, at mobile, tablet and desktop widths.

## Glossary

These terms are used consistently in the UI and in this spec.

| Term | Meaning | UI rules |
| --- | --- | --- |
| Work | A book as an idea ("Pedro Páramo"), independent of printing | Search results and the book page are always at work level |
| Edition | A specific printing: ISBN, language, publisher, year, page count, format, cover | Picked automatically (user's language, most common); changeable via the edition selector |
| Author | Person who wrote a work | Has its own page |
| Series | Ordered set of works ("Book 2 of X") | Has its own page; data may be missing for some books |
| Status | One of 4 fixed, mutually exclusive states: Reading, Read, Want to read, Abandoned | A book has exactly one status; cannot be deleted or renamed |
| Tag | User-created shelf with a name and a color ("Favorites 2026") | A book can have many tags |
| Reading | One read-through of a book, with start/finish dates (optional) and progress | Rereading creates a new reading; "Read ×3" = 3 finished readings |
| Session | A manual progress log: date + new page/percentage | Any progress on a day counts toward the streak |
| Streak | Consecutive days with at least one session, in the user's time zone | Breaks with no grace days |
| Highlight | Literal text from the book, tied to a page | Can have many notes |
| Bookmark | A marked page with no book text | Can have many notes |
| Note | The user's own reflection, short or very long | Always attached to a highlight or bookmark |
| Review | Final opinion of the book, optional, one per book, editable | Public or private; public ones must declare spoilers before publishing |
| Rating | Optional, one per book, editable; stored 0–100 | Displayed in the user's chosen scale |
| Manual book | A book the user created by hand | Private to its creator until the admin approves or merges it |
| Visibility | Public / Private / Inherit, resolved user → book → item | See Privacy controls in Global patterns |

## Brand and visual identity

Verso should feel like a private library at night: leather, dark wood, tall bookshelves, warm lamp light, a glass of wine — quiet luxury, "old money", never flashy. Reading is treated as a sacred ritual. Elegant and minimal, with warm pops of color.

**References:** Fable (warmth, book-centric), "Sudoku – The Clean One" (clean, no noise), classic luxury cars and cigar lounges (deep, warm, strong colors).

### Color palette — "Burgundy and tobacco"

| Token | Light mode | Dark mode | Use |
| --- | --- | --- | --- |
| background | #F3ECDF (cream paper) | #1E1A17 (warm charcoal) | Page canvas; never pure white or pure black |
| surface | #FAF6EE | #27221E | Cards, panels, top bar |
| surface-raised | #FFFDF8 | #312A25 | Modals, menus, popovers |
| text-primary | #1E1A17 | #EFE6D6 | Body and headings |
| text-secondary | #5E554C | #B3A797 | Metadata, helper text |
| border | #E2D8C6 | #3A322B | Hairlines (1px) |
| accent (wine) | #5C1A24 | #A04452 | Primary buttons, Reading status, active nav, links |
| tobacco | #7A4E2D | #C08F68 | Secondary accent, charts, generated covers |
| brass | #B08D57 | #C4A26B | Thin rules, focus details, streak and achievements, highlight quote bar |
| success | #4F6B3A | #7E9C66 | Confirmations |
| warning | #8A5A14 | #D3A04E | Warnings |
| danger | #B23A2E | #E4806F | Errors, destructive actions (distinct from wine) |

Contrast-adjusted for WCAG AA (text >= 4.5:1 on background, surface and surface-raised): warning light, tobacco dark, danger dark. Brass light (2.6:1) is decorative only; focus rings use `--focus-ring` (#8F6F3A light, brass dark).

Rules: wine is an accent, never a large background except in the landing hero and Wrapped. Brass is the "pop" — used sparingly, mostly as 1px lines and small details. Dark mode follows the system by default; users can force light or dark. All text/background pairs must meet WCAG AA (verify the values above and adjust if needed).

Tag colors (user-selectable): wine, tobacco, brass, forest green #2F4A36, navy #1C2638, oxblood #5A1C1E, slate #4A5560, sand #C9B48F.

### Typography

- **Display serif:** Cormorant Garamond (500, with italic) — logo, page titles, book titles on detail pages, highlight quotes, generated covers, landing headlines. Only at 20px and up.
- **UI sans:** Inter (400, 500, 600) — everything else: navigation, buttons, forms, metadata, tables.
- Scale (desktop): display 56/64 · h1 40/48 · h2 28/36 · h3 20/28 · body 16/26 · small 14/22 · caption 12/18. Reduce display and h1 \~25% on mobile.
- Numbers in stats use Inter with tabular figures.

### Shape, elevation, icons

- Corner radius: 6px for cards, inputs and buttons; 4px for chips and tags; book covers 2px on the spine side, 4px on the open side. Nothing pill-shaped except toggles and avatars (circular).
- Shadows: soft, warm-tinted, low (e.g. 0 1px 2px and 0 8px 24px of rgba(30,26,23,0.08)). Used for covers, modals and menus only. Cards rely on borders.
- Icons: thin line icons (1.25–1.5px stroke, e.g. Lucide or Phosphor Light), always paired with a text label except universally obvious ones (close, search, more "⋯", bell). **No emojis anywhere in the UI.**
- No illustrations. Empty states use text only.

### Motion

Subtle and slow-ish: 150–250ms ease-out transitions, fades and small translations. Finishing a book triggers a brief brass shimmer on the cover and the "Read" badge — no confetti. Streak increments animate the number gently. Respect reduced-motion settings.

### Voice and copy

Neutral and functional, sentence case, no exclamation marks, no emojis. Examples: "Book added to Want to read", "Session saved", "Start by adding the book you're reading". Every string exists in English and Spanish; Spanish runs \~20% longer, so layouts must tolerate it.

### Logo

Wordmark only: "Verso" in Cormorant Garamond, italic or roman (designer to explore both), in text-primary or cream on dark. No symbol. Favicon/app icon: a refined "V" monogram from the same wordmark on wine.

### Generated covers

When a book has no cover: a cloth-bound book look — solid background from {wine, tobacco, forest green, navy, oxblood, slate}, chosen deterministically from the title; an inset 1px brass frame; title in Cormorant Garamond italic, centered, cream; author in small Inter caps at the bottom. Same aspect ratio as real covers (2:3).

## Global patterns

### Web navigation \[F1\]

A horizontal top bar, editorial in feel, on every signed-in screen:

- **Left:** "Verso" wordmark → Home.
- **Center:** Home · Library · Stats (active item underlined with a 1px brass rule).
- **Right:** search field (compact; also opens with ⌘K / Ctrl+K) · notification bell with unread count · avatar menu (Profile, Settings, Admin — only for the admin role, Sign out).
- **Below 768px:** the top bar shows wordmark, search and bell; navigation moves to the bottom tab bar (see Mobile as a PWA).

### Search behavior \[F1\]

Typing in the top-bar field opens a dropdown with quick results: **Books** (max 5 works) in F1, and a **Users** group (max 5) that arrives with user search in M8.5 [F2]. Enter opens the full search results page. Recent searches show when the field is focused and empty. A genre alone is a valid search: `/search?genre=<subject>` (the target of the S3 genre chips) lists books of that subject with an empty field and a removable chip (SPEC 18).

### Responsive

Breakpoints: mobile < 768px, tablet 768–1199px, desktop ≥ 1200px. Max content width 1200px, centered. Cover grids reflow: 2 columns mobile, 4 tablet, 6 desktop.

### States (every screen)

- **Loading:** skeletons shaped like the final content (cover rectangles, text lines), never spinners for whole pages.
- **Empty:** a short heading + one sentence + one primary action, text only.
- **Error:** what happened + what to do + a Retry button. Inline field errors under inputs.
- **Toasts:** bottom-center, auto-dismiss in 4s, for confirmations ("Session saved") and undo where possible ("Book archived · Undo").

### Accessibility

WCAG 2.1 AA: contrast, full keyboard navigation, visible focus ring (2px brass outline with offset), labels for all inputs, alt text for covers ("Cover of {title}"), touch targets ≥ 44px, reduced-motion support.

### Internationalization

All UI text in English and Spanish. Book metadata (titles, synopses) is never translated. Dates, numbers and plurals follow the active locale ("1 book / 2 books", "1 libro / 2 libros").

### Rating display

Stored 0–100; displayed per user preference:

- Stars (choose whole, half or quarter steps) — drawn as thin outline stars filled in brass.
- 1–10 with one decimal ("7.3").
- 1–100 ("73").

Ratings are always optional. The rating input matches the chosen scale (star picker, slider with numeric field). Other users' ratings are shown in the viewer's own scale.

### Progress display

Users choose to view and enter progress in pages or percentage (Settings, and a toggle inside the Log progress modal). If an edition has no page count, progress is percentage only. Progress bars are thin (3px), brass fill on a border-colored track.

### Privacy controls

Visibility resolves in three levels; each item can be Public, Private or Inherit:

1. **User:** profile Public or Private; default visibility for annotations.
2. **Book in library:** hidden from profile or visible; default visibility for that book's annotations.
3. **Item:** each highlight, bookmark, note and review can override what it inherits.

UI: a small lock icon on every annotation and review (closed = private, open = public) toggles its visibility, with a tooltip explaining the inherited value ("Private — inherited from this book"). A private profile hides everything from non-followers, including public reviews — they do not appear on book pages either.

## Public screens

### P1. Landing \[F1\]

The brand's showcase; the first thing a recruiter sees. Top bar: wordmark left; "Sign in" (ghost) and "Create account" (primary) right.

1. **Hero — "the library at night".** Always dark (warm charcoal) regardless of theme. Left: headline "Your library. Your ritual." / "Tu biblioteca. Tu ritual." in display serif; subheadline "Track what you read, keep what you highlight, and discover how you read. No noise."; primary button "Create account", text link "Sign in". Right: a tall bookshelf composed of generated cloth-bound covers in wine, tobacco, forest green and cream, on shelves edged with a thin brass line, softly lit by warm lamp light. No stock photos.
2. **Transition to day:** scrolling shifts to the cream background.
3. **Key features** (4 blocks, line icon + title + one sentence): Library with one result per book; Progress and streaks; Highlights, bookmarks and notes; Stats.
4. **App preview:** a framed screenshot of the Library and the Book detail, desktop and phone side by side.
5. **Why Verso:** three short statements — no edition chaos; real privacy (public, private, per item); built for readers who take reading seriously.
6. **Final call to action:** "Start your library" + Create account.
7. **Footer:** wordmark, About, Privacy, Terms, GitHub link, © year. No language switch here (language follows the browser; change it in Settings).

Alternative headlines for exploration: "Read with intention.", "For those who read slowly.", "Reading deserves better.", "Every page counts."

### P2. Sign in / Create account \[F1\]

- **Layout:** split screen. Left half (dark, wine or charcoal): a literary quote from a public-domain author in large serif italic, with the author's name; it changes on each visit. Right half: the form on surface color. On mobile the quote collapses to a short band at the top.
- **Create account:** name, email, password (with show/hide and strength hint), "Create account" button, divider "or", "Continue with Google". Link to Sign in.
- **Sign in:** email, password, "Forgot password?" link, Sign in button, Google button, link to Create account.
- **Verify email:** confirmation screen "Check your inbox" with the email shown and "Resend email" (with cooldown timer).
- **Forgot password:** email field → "If an account exists, we sent a link". **Reset password:** new password + confirm.
- Errors: wrong credentials, email already in use, expired link, rate limited.

### P3. Onboarding \[F1\]

One step per screen, with a thin progress bar and "Step 2 of 7". Back button on every step after the first (step 1 has nowhere to go back to); optional steps show "Skip".

1. **Name and username** (required): display name; @username with live availability check.
2. **Profile photo** (optional): upload and crop to circle; initials fallback.
3. **Rating style:** three selectable cards — Stars (then whole/half/quarter), 1–10 with decimal, 1–100 — each with a live interactive preview.
4. **Progress style:** Pages or Percentage, with a small progress-bar preview.
5. **Profile privacy:** Public or Private, each with a one-line explanation of who sees what.
6. **Yearly goal** (optional): number input "How many books do you want to read in {year}?", where the year is the current year in the user's time zone. Left empty, Continue moves on without saving.
7. **Coming from Goodreads?** (optional): explanation + "Import my library" (goes to the import flow) or "Skip". Until the import ships (M11, S15) the step shows the explanation and Skip only.

End: lands on Home in its empty state.

## Core app screens \[F1\]

### S1. Home

- **Greeting, always present and changing:** by time of day ("Good morning / afternoon / evening, Ale") in display serif. Optional second line, contextual and sober: "40 pages left in *Pedro Páramo*", "12 days in a row", "No reading logged today".
- Sections, in order:
  1. **Currently reading:** horizontal carousel of large covers. Each card: cover, title, author, thin progress bar, "p. 150 of 300" or "50%", and a "Log progress" button (opens S9). Rereads show "Reread · Read 2×".
  2. **Streak:** current streak number ("12 days") + the last 7 days as small marks (filled brass = read, outline = not).
  3. **Yearly goal:** "12 of 30 books" with a progress bar; link to set a goal if none.
  4. **This month:** pages read, books finished, average pages per day.
  5. **Recent highlights:** the 3 latest highlights (serif italic, book title, page), link "See all" to the book.
  6. **Want to read:** a row of covers to pick the next book.
  7. &#91;F3\] Feed section (see F3). \[F5\] "For you" recommendations (see F5).
- **Empty state (new user):** "Start by adding the book you're reading", an inline search field, and a secondary button "Import from Goodreads".

### S2. Search results

- Query field at top, tabs **Books** and **Users** with counts. F1 ships the Books list only, with a "Books" heading and no tabs or counts (the API returns no total). Tabs, counts and Users arrive with user search in M8.5 [F2].
- **Books:** Near-duplicate works are merged into one row, and 1-edition entries sit behind one "Show more matches (N)" button after the list (M3.3b). List rows — cover thumbnail, title (serif), author(s), first publication year, number of editions ("12 editions"). If the book is in the user's library: a status badge ("Reading", "Read ×2"), added with the library in M4.2. Click → Work page.
- Quick action on each row: split button "Want to read" + chevron (see Add-to-library control below). Added in M4.2, because it needs the library.
- **Users** (M8.5 [F2]): avatar, display name, @username, "Private" lock badge if applicable. Click → Profile (follow button lives only there).
- "Can't find your book? Add it manually" link at the bottom of book results → S14.
- Empty: "No books match ‘{query}’" + manual add link. Error and loading states as global.

### Add-to-library control (reusable)

A split button: the large part adds the book to **Want to read**; a small chevron tab opens a menu with all statuses (Reading, Read, Want to read, Abandoned). Once added, it becomes a status dropdown showing the current status.

### S3. Work page

- **Layout:** classic editorial — large cover left (with soft shadow), info right.
- **Info:** title (display serif), subtitle, author(s) linked to S5, series line "Book 2 of {Series}" linked to S6 (when known), genres as clickable chips (→ search filtered by genre; only the 12 genres of a fixed list in `packages/shared` show a chip, SPEC 18), first published year, page count of the selected edition, synopsis (collapsed to 5 lines with "Read more").
- **User block:** Add-to-library control; if in library: status, progress, your rating, link "Go to my book" (S8). Added with the library in M4 and M5. Edition line: "Edition: Spanish · Penguin · 2019 · 320 pages · Change" (opens S4). The edition line ships in M3.5 as local state: choosing an edition changes the page only, nothing is saved before M4.
- **Reviews:** public reviews from public profiles only, newest first. Each: avatar, name, rating in the viewer's scale, date, text (collapsed if long). Reviews marked with spoilers show "This review contains spoilers · Show". Empty: "No reviews yet". Added with reviews in M6; not shown before.
- No community averages or reader counts in F1.

### S4. Edition selector (modal)

- Language filter (chips) at top; list of editions: cover, language, publisher, year, page count, format (paperback, hardcover, ebook), ISBN. The current one is marked "Selected".
- Selecting while a reading is in progress shows a note: "Your progress will be converted: p. 150 of 300 (50%) → p. 200 of 400". Confirm / Cancel. Added with reading progress in M5. Before that, selecting an edition closes the modal and updates the work page.
- The language chips appear only when the editions have two or more languages.

### S5. Author page

- Photo (or initials on tobacco), name in display serif, life years, biography (collapsed, "Read more").
- Works as a cover grid ordered by publication year; covers of books in the user's library show a small status badge. The badge is added with the library in M4.

### S6. Series page

- Series name, "You've read 2 of 5". Added with the library in M4.
- Ordered list: number (1, 2, 3…), cover, title, year, the user's status or the Add-to-library control (status and control added in M4). Series exist only for works already in the catalog tables, so the S3 series line and this page are reachable only after M4.

### S7. My library

- Header: "Library" + total count; view toggle (grid / list); sort menu: date added, title, author, rating, progress, date finished; "Add book" button.
- **Status tabs:** Reading · Read · Want to read · Abandoned · All (each with count).
- **Tag chips** row under the tabs (colored dot + name), multi-select to filter, "Manage tags" link (→ Settings).
- **Grid card:** cover only. Thin progress bar on Reading books; small "×2" mark on rereads. On hover: overlay with title, author, rating, and quick menu (change status, tags, hide from profile).
- **List row:** cover, title, author, status, progress, rating, tags, date.
- Hidden-from-profile books show a small lock.
- Empty per tab: e.g. "No books in Abandoned". Whole-library empty → same as Home empty state.
- No bulk actions in F1.

### S8. My book detail

The most important screen.

- **Header:** cover; title, author, edition line (Change → S4); status dropdown; progress bar with numbers and "Log progress" button; rating input in the user's scale; tags (add/remove, color chips); reading counter "Reread · Read 2×" when applicable; "⋯" menu: Hide from my profile, Visibility of this book's annotations (Public / Private / Inherit), Reread (when Read), Abandon (when Reading), Start over (when Abandoned: resume from saved page is default), Remove from library.
- **Tabs:**
  1. **Annotations:** ordered by page, no filters. "Add highlight" and "Add bookmark" buttons. A **highlight** shows the literal text in serif italic with a 2px brass bar on the left, page number, lock icon, and its notes nested below. A **bookmark** shows a page marker ("p. 80") with its notes nested below. Each item: "Add note", edit, delete. Notes support long text with line breaks; long notes collapse with "Read more".
  2. **Sessions:** list of sessions (date, from → to page or %, pages read), edit/delete each.
  3. **Readings:** history of read-throughs: "Reading 2 · started Mar 3, 2026 · in progress", "Reading 1 · Jan 2 – Feb 10, 2025 · finished", "Abandoned at p. 120". Dates editable; unknown dates shown as "Date unknown".
  4. **Review:** one review per book, editable. Text editor, visibility toggle (Public / Private). When publishing as public, a required question: "Does this review contain spoilers?" Yes / No.
- **Finishing:** when progress hits the last page or 100%, a dialog asks "Did you finish it?" → status becomes Read with today's date, brass shimmer, then optional rating and review prompt.
- **Remove from library** dialog: choose "Archive" (recoverable, hidden everywhere) or "Delete permanently" (removes sessions, annotations, review and rating; requires typing the title or a second confirmation).

### S9. Log progress (modal)

- Opened from Home and Book detail only.
- Fields: current page **or** percentage (toggle, defaults to the user's preference), date (defaults to today, editable for past days).
- **The toggle is remembered per book.** The first time a book is logged the toggle starts on the user's default (Settings, set in onboarding). When the user switches it, the choice is saved for that book and the modal opens on it from then on, until it is switched again. Changing the default in Settings never rewrites a book's saved choice. A book without a page count is always percentage and the toggle is hidden.
- Live helper: "+32 pages since your last session" and the updated progress bar.
- Secondary actions: "Add highlight" and "Add bookmark" (open the annotation form prefilled with the current page).
- Save → toast "Session saved"; streak updates; if 100%, triggers the finish dialog.

### S10. Stats

- **Period selector:** Year (dropdown) · Month · Custom range (date picker) · All time.
- **Headline numbers:** books finished, pages read, average pages per day, longest streak.
- **Yearly goal** progress (when period is a year).
- **Charts** (palette: wine, tobacco, brass; thin, minimal axes): pages per month (bars); books per year (bars, All time); genres (horizontal bars, top 8); top authors (ranked list with cover thumbnails); reading pace over time (line).
- **Reading calendar:** GitHub-style heatmap of days with sessions, brass intensity by pages read; hover shows date and pages.
- **Records:** longest book, fastest read (pages/day), highest-rated book.
- Rules shown as helper text: abandoned books don't count; books marked read without dates count in totals only ("12 books with unknown dates").
- &#91;F2\] "Your Wrapped" cards for current and past years.
- Empty: "Your stats appear after your first session".

### S11. Profile (own and others')

- **Header:** avatar, display name (serif), @username, short bio, followers · following counts (clickable), "{n} books read this year". Own profile: "Edit profile". Others: "Follow" / "Requested" (click to cancel) / "Following" (menu: Unfollow).
- **Four favorites:** four pinned covers above the tabs (Letterboxd-style); own profile shows "Choose favorites" slots.
- **Tabs:** Library (status sub-tabs, public books only) · Reviews (public only) · Highlights (public highlights with their public notes).
- **Private profile, viewer not following:** header with avatar, name, counts, a lock and "This account is private", and the Follow request button. No tabs.
- **Followers / Following:** modal list with avatar, name, @username; own followers list has "Remove" per follower (no blocking). Own profile shows pending requests at the top of Followers with Accept / Decline.
- Profile pages are shareable links with good link previews (cover-style card with name and favorites).

### S12. Notifications

- **Dropdown** from the bell (latest 10, unread marked with a brass dot, "Mark all as read", "See all") and a **full page** with the complete list.
- Types \[F1\]: follow request (Accept / Decline inline) · new follower · your follow request was accepted · Goodreads import finished (link to summary) · your manual book was approved.
- Types \[F3\]: likes and comments on your activity. Types \[F4\]: club invitations, new thread replies, vote opened/closed.
- Empty: "You're all caught up".

### S13. Settings

Left sub-navigation (top tabs on mobile):

1. **Profile:** photo, display name, username, bio.
2. **Account:** email (change with verification), password, link/unlink Google.
3. **Preferences:** rating style, progress style, language (English / Español), theme (System / Light / Dark), time zone.
4. **Privacy:** profile Public / Private; default annotation visibility; list of books hidden from profile (unhide each).
5. **Tags:** create, rename, change color (from the tag palette), delete (with count of affected books).
6. **Yearly goal:** set or change.
7. **Data:** Import from Goodreads (→ S15); Export my library — choose CSV or JSON; archived books (restore).
8. **Delete account:** explanation + confirmation by typing the username.

### S14. Add a book manually

- Form: title\*, author(s)\* (multiple), page count, ISBN, publisher, year, language, synopsis, genres, series + number, cover (upload, or keep the generated one with live preview).
- Helper: "Without a page count, progress for this book will be in percentage only."
- After saving: the book goes straight into the library with a status picker; a note says "Only you can see this book".

### S15. Import from Goodreads

1. **Instructions:** how to export from Goodreads (numbered steps) + file drop zone for the CSV.
2. **Map shelves:** Goodreads shelves listed; exclusive shelves map to statuses; common names ("dnf", "abandoned", "did-not-finish") are pre-mapped to Abandoned; others become tags (with a color picker); user can change each mapping.
3. **Progress:** live progress bar ("132 of 245 books"), with "You can leave this page — we'll notify you when it's done".
4. **Summary:** "245 imported · 12 need review". Review list: each unresolved book shows its Goodreads data with "Find the right book" (search) or "Keep as manual book".

Ratings convert from 5 stars to 0–100; read dates and read counts are imported.

### S16. Admin — manual books

- Only visible to the admin role (avatar menu → Admin).
- List of pending manual books: cover, title, author, creator, date, count of users who have it.
- Detail: the book's data side by side with a search to find an existing work; actions **Approve** (becomes public), **Reject** (stays private), **Merge** into the selected work/edition (all users' readings move to it).
- Empty: "No books pending review".

## Mobile as a PWA \[F1.5\]

There is no native app. Mobile is the same web app, installable as a Progressive Web App (PWA) from the browser, with mobile-native patterns and the same visual identity. It requires an internet connection; the app shell and last-viewed data are cached so screens don't load blank.

- **Install:** web app manifest (name Verso, wine theme color, cream/charcoal background, "V" monogram icons, standalone display). An "Install Verso" prompt appears in Settings and once as a dismissible banner on Home (Android: native install prompt; iOS: short instructions "Share → Add to Home Screen").
- **Bottom tab bar below 768px** (in the browser and installed): thin line icon + label — Home · Library · Search · Stats · Profile. Active tab in wine with a brass dot. Replaces the hamburger menu. Respects safe areas (notch, home indicator).
- **Home:** bell icon top-right (badge for unread). Same sections as S1; Currently reading is a swipeable carousel.
- **Profile:** gear icon top-right → Settings.
- **Search tab:** search field with Books / Users segments; a **barcode scan** button opens the camera in the browser, reads the ISBN and goes to the matching Work page (or offers manual add if not found). Needs camera permission; show a clear fallback if denied.
- **Log progress:** a bottom sheet with large numeric input, page/percent toggle, date, Save. Vibration on save only where supported (Android); none on iOS.
- **Annotations:** add highlight/bookmark as a full-screen sheet with a large text area.
- **Modals** (edition selector, add to library, menus) become bottom sheets.
- **Push notifications (Web Push):** daily reading reminder (on/off + time picker in Settings, copy: "No reading logged today") and F1 social notifications (follow requests, new followers, accepted requests). Android: works in the browser and installed. **iPhone: only works when Verso is installed to the Home Screen** — Settings shows "Install Verso to get notifications on iPhone" when not installed.
- **Desktop-oriented:** Goodreads import and Admin work on mobile widths but are designed desktop-first.
- Onboarding: same 7 steps as full-screen pages, plus an optional final step "Turn on reminders" (asks for notification permission only after the user taps it).

## Wrapped \[F2\]

- **Availability:** from December 1 for the current year; past years always available from Stats. A Home banner announces it: "Your 2027 in reading is ready".
- **Format:** full-screen vertical slides that advance on tap (left/right tap zones, progress segments at top, pause on hold), in the dark palette with wine backgrounds and brass details, display serif for big numbers.
- **Slides:** intro · total books and pages · most-read month · top genre · top author · highest-rated book · longest book · longest streak · rereads · yearly goal met or not · quote of the year · closing summary.
- **Quote of the year:** chosen by the user before viewing, or taken from highlights marked as favorites. This adds a **favorite toggle (brass outline star) on highlights** from F2 on.
- **Share:** each slide downloads as a 9:16 image for Instagram stories, with the Verso wordmark small at the bottom.

## Feed \[F3\]

- **Location:** a section on Home, below Currently reading and Streak, titled "From people you follow", with "See more" loading older items.
- **Events:** started a book · finished a book · rated a book · published a public review · shared a public highlight. Each item: avatar, name, action sentence, time, book cover thumbnail, and the rating/review excerpt/highlight when relevant. Spoiler reviews stay hidden behind "Show".
- **Interactions:** like (outline heart, count) and comments (thread under the item; edit/delete own comments; the activity owner can delete any comment on their item).
- Respects privacy: only public items; private profiles' items are shown only to approved followers.
- New notification types: likes and comments.
- Empty: "Follow readers to see their activity here" + link to user search.

## Clubs \[F4\]

New top-bar item "Clubs" (and a sixth mobile tab, or a Clubs entry in Home — designer to propose).

- **Clubs index:** My clubs (cover, name, current book, member count, next deadline) + Discover public clubs (search, list) + "Create club".
- **Create club:** name, description, cover image, visibility (Public = searchable and joinable / Invite only = join via link). Anyone can create clubs. Roles: creator and members only.
- **Club page:** header (cover, name, description, members avatars, invite link for the creator); **Current book** with start and end dates, weekly goal ("Chapters 1–5 this week") and every member's progress on a shared bar; **Discussion** tab; **Past books** tab; **Vote** tab.
- **Discussion:** forum-style threads, one per chapter. A member only sees threads for chapters up to their own progress; later chapters appear locked: "Read up to chapter 7 to unlock". Thread: posts with avatar, name, time, text, replies; creator can delete posts.
- **Voting for the next book:** creator opens a vote with candidate books (search to add) and a closing date; members vote once; results shown after closing; the winner becomes the next current book.
- No live presence (no online/reading-now indicators).
- Creator actions: edit club, set current book and schedule, remove members, delete club. Members: leave club.
- Empty states: "You're not in any clubs yet", "No threads unlocked yet".

## AI recommendations \[F5\]

- **Home:** a "For you" row of 4–6 recommended covers. **Dedicated page** "Recommendations" with the full list.
- **Each recommendation:** cover, title, author, and a short "Why" line based on the user's library ("Because you rated *Pedro Páramo* 9.4 and saved many highlights about memory"). Actions: Add-to-library control (default Want to read) and "Not interested" (removes it and informs future suggestions).
- **Refresh:** updated weekly automatically; a "New recommendations" button with a daily limit ("2 refreshes left today"); loading state with a sober skeleton and "Preparing your recommendations".
- Only recommends books that exist in the catalog (verified), never invented titles.
- Empty: needs at least 5 rated books — "Rate a few more books to get recommendations".

## Out of scope and future

Do not design these in detail; they are recorded so nothing is assumed.

**Removed from the project:** semantic search over highlights; AI verification of manual books (manual review only); photo-to-highlight (OCR); live presence in clubs.

**Not now, maybe later \[Future\]:**

- Audiobooks with progress in minutes.
- Community data on book pages (average rating, reader counts).
- Bulk actions in the library.
- Blocking users and reporting reviews/comments.
- Duplicate suggestions in the admin panel.
- Native mobile app (e.g. Expo) consuming the same API; home-screen widgets (current book, streak).
- Offline mode.
- Reading timer (sessions stay manual).
- Streak grace days (streaks break with no exceptions).
