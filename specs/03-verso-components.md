# SPEC 03 — Verso UI components (M1.3)

> **Status:** Approved
> **Depends on:** SPEC 02
> **Date:** 2026-11-21
> **Objective:** Build the eleven presentational Verso components in `apps/web/src/components/verso/` (BookCover, GeneratedCover, ProgressBar, RatingDisplay, RatingInput, StatusDropdown, AddToLibraryButton, TagChip, LockToggle, EmptyState, ErrorState), with component tests for RatingInput and ProgressBar.

## Why this spec exists

M1.3 runs before M1.4 (`Rating`, `GeneratedCover` in `packages/shared`) and M1.5 (i18n). The components must not wait for either, so they are purely presentational: all text arrives as props and all data arrives already resolved. M1.4, M1.5 and later milestones do the wiring.

## Scope

**In:**

- Components in `apps/web/src/components/verso/`, one file each (`BookCover.tsx`, `GeneratedCover.tsx`, `ProgressBar.tsx`, `RatingDisplay.tsx`, `RatingInput.tsx`, `StatusDropdown.tsx`, `AddToLibraryButton.tsx`, `TagChip.tsx`, `LockToggle.tsx`, `EmptyState.tsx`, `ErrorState.tsx`) plus `index.ts`.
- Built on existing primitives in `components/ui/` (Button, DropdownMenu, Tooltip, Skeleton) and on tokens only.
- Every component: loading state where it makes sense (`BookCover`, `ProgressBar` via `Skeleton`), light and dark, keyboard access, visible focus ring.
- Test setup for `apps/web`: `vitest.config.ts` (jsdom, React plugin, `@` alias), setup file with jest-dom.
- Component tests: `RatingInput.test.tsx`, `ProgressBar.test.tsx`.
- Dev-only demo page `apps/web/src/app/dev/components/page.tsx` showing every component and state; returns `notFound()` when `NODE_ENV === 'production'`.

**Out of scope (for future specs):**

- `Rating` value object and `GeneratedCover` hash/color picker in `packages/shared` (M1.4). Here the cover receives `tone` as a prop.
- next-intl and message catalogs (M1.5). Here every label is a prop.
- Any API call, TanStack Query hook or navigation. `AddToLibraryButton` and `StatusDropdown` only call callbacks (wiring is M4.2 and M4.3).
- Cover hover overlay and library-card composition (M4.4).
- Shimmer on finish (M5.3).
- Tests for the other nine components (CLAUDE.md asks only for RatingInput and ProgressBar here; AddToLibraryButton and LockToggle tests arrive with their wiring).

## Data model

No new data or API. Prop contracts (local to `apps/web`):

```ts
// book-status.ts (moves to packages/shared in M4.1)
export type BookStatus = 'READING' | 'READ' | 'WANT_TO_READ' | 'ABANDONED';

export type CoverTone = 'wine' | 'tobacco' | 'forest' | 'navy' | 'oxblood' | 'slate';
export type RatingStyle = 'STARS_WHOLE' | 'STARS_HALF' | 'STARS_QUARTER' | 'DECIMAL_10' | 'HUNDRED';

BookCover:    { title; author?; coverUrl?: string | null; tone: CoverTone; size: 'sm'|'md'|'lg'; loading?: boolean }
ProgressBar:  { valueBp: number /* 0-10000 */; label?: string; loading?: boolean }
RatingDisplay:{ value: number | null /* 0-100 */; style: RatingStyle; formatted: string; emptyLabel: string }
RatingInput:  { value: number | null; style: RatingStyle; onChange(v: number | null): void; labels: { clear; star(n); slider; field } }
StatusDropdown:{ status: BookStatus; options: Record<BookStatus,string>; onChange(s: BookStatus): void; disabled? }
AddToLibraryButton:{ status: BookStatus | null; labels; onAdd(s: BookStatus): void; onChange(s: BookStatus): void; pending? }
TagChip:      { name; color: 'WINE'|'TOBACCO'|'BRASS'|'FOREST'|'NAVY'|'OXBLOOD'|'SLATE'|'SAND'; selected?; onToggle? }
LockToggle:   { visibility: 'PUBLIC'|'PRIVATE'; tooltip: string; label: string; onToggle(): void }
EmptyState:   { heading; description; action?: { label; onClick } }
ErrorState:   { heading; description; retryLabel; onRetry(): void }
```

Conventions:

- Ratings are 0–100 integers. Star steps: whole 20, half 10, quarter 5. Decimal 1–10 uses step 10 (display value/10 with one decimal); hundred uses step 1.
- Progress is basis points, clamped to 0–10000 and rendered as a 3 px bar, brass fill on border-colored track.
- No emojis. Icons are thin line icons from `components/ui/icons.tsx` (extend it for star, lock, lock-open, chevron-down, plus if missing), always paired with a text label, except where DESIGN.md allows (close, search, more, bell).
- `BookCover` image has `alt` "Cover of {title}" supplied by caller through a `coverAlt` prop; aspect ratio 2:3; radius 2 px spine side and 4 px open side; uses `GeneratedCover` when `coverUrl` is empty or the image fails to load.
- `GeneratedCover`: solid tone background, 1 px inset brass frame, title in Cormorant Garamond italic, cream, centered; author in small Inter caps at the bottom.
- `AddToLibraryButton`: split button. Main part adds to `WANT_TO_READ`; chevron opens the four statuses. Once `status` is set it renders as `StatusDropdown`.

## Implementation plan

1. Add dev dependencies `vitest` config pieces: `jsdom`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`. Create `vitest.config.ts` and `vitest.setup.ts`. Verify: `pnpm --filter @verso/web test` still passes (existing api-client tests).
2. Create `components/verso/types.ts` (`BookStatus`, `CoverTone`, `RatingStyle`) and `index.ts`. Verify: `pnpm --filter @verso/web typecheck`.
3. Implement `GeneratedCover` and `BookCover` (with loading skeleton and image-error fallback).
4. Implement `ProgressBar` and its test.
5. Implement `RatingDisplay` and `RatingInput` (star picker for the three star styles; slider plus numeric field for DECIMAL_10 and HUNDRED; clear action) and the `RatingInput` test.
6. Implement `StatusDropdown` and `AddToLibraryButton`.
7. Implement `TagChip`, `LockToggle`, `EmptyState`, `ErrorState`.
8. Add the dev demo page covering every component and state. Verify in browser: light and dark, 375 px, 768 px and 1280 px widths.
9. Tick M1.3 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [ ] `components/verso/` exports all eleven components from `index.ts`.
- [ ] No component imports `next-intl`, `@tanstack/react-query` or `api-client`.
- [ ] No hardcoded user-facing strings in components (the dev demo page is the only exception).
- [ ] No raw hex colors or arbitrary color values; only tokens from `styles/tokens.css`.
- [ ] `RatingInput` with `STARS_HALF`: pressing the left half of the third star calls `onChange(50)`; clicking the same value again or the clear action calls `onChange(null)`.
- [ ] `RatingInput` with `STARS_WHOLE`, ArrowRight/ArrowLeft change the value by 20 and clamp to 0–100.
- [ ] `RatingInput` with `DECIMAL_10`, typing `7.3` in the field calls `onChange(73)`; with `HUNDRED`, typing `73` calls `onChange(73)`.
- [ ] `ProgressBar` exposes `role="progressbar"` with `aria-valuenow` equal to `valueBp / 100`.
- [ ] `ProgressBar` clamps `-5` to 0 and `12000` to 10000.
- [ ] `RatingDisplay` with `value: null` shows `emptyLabel` and no stars.
- [ ] `BookCover` falls back to `GeneratedCover` when `coverUrl` is null or the image errors.
- [ ] `AddToLibraryButton` with `status: null` calls `onAdd('WANT_TO_READ')` on the main click and `onAdd(<chosen>)` from the menu; with a status it renders the `StatusDropdown`.
- [ ] `LockToggle` is a button with `aria-pressed` reflecting `visibility` and shows the `tooltip` text on focus and hover.
- [ ] Every interactive component is reachable and operable by keyboard and shows the 2 px brass focus ring; touch targets are at least 44 px.
- [ ] Animations are disabled under `prefers-reduced-motion`.
- [ ] `/dev/components` renders in development and returns 404 in a production build.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [ ] The M1.3 checkbox in `ROADMAP.md` is ticked in the same PR.

### UI states: BookCover

- [ ] **Normal:** real cover or generated cover at 2:3.
- [ ] **Loading:** skeleton rectangle with the same size; no layout jump.
- [ ] **Empty:** N/A, a missing cover renders `GeneratedCover`.
- [ ] **Error:** image load failure falls back to `GeneratedCover`.
- [ ] **Light theme:** legible, tokens only.
- [ ] **Dark theme:** legible, tokens only.
- [ ] **Mobile:** works at 375 px, no horizontal scroll.
- [ ] **Desktop:** works at 1280 px.

### UI states: ProgressBar, RatingDisplay, RatingInput, StatusDropdown, AddToLibraryButton, TagChip, LockToggle

- [ ] **Normal:** renders with real props and all elements present.
- [ ] **Loading:** `ProgressBar` has a skeleton; the others N/A (they render from already-loaded data; callers show `Skeleton`).
- [ ] **Empty:** `RatingDisplay` and `RatingInput` render the no-rating state; `ProgressBar` at 0 shows an empty track; the others N/A.
- [ ] **Error:** N/A, these components have no failure mode of their own (`AddToLibraryButton` and `StatusDropdown` expose `disabled`/`pending` instead).
- [ ] **Light theme:** all states legible, tokens only.
- [ ] **Dark theme:** all states legible, tokens only.
- [ ] **Mobile:** all states work at 375 px, no horizontal scroll.
- [ ] **Desktop:** all states work at 1280 px.

### UI states: EmptyState and ErrorState

- [ ] **Normal:** heading, one sentence, one primary action, text only, no illustration.
- [ ] **Loading:** N/A, these are the terminal states of a loading flow.
- [ ] **Empty:** `EmptyState` without `action` still renders heading and description.
- [ ] **Error:** `ErrorState` shows what happened, what to do and a Retry button that calls `onRetry`.
- [ ] **Light theme:** legible, tokens only.
- [ ] **Dark theme:** legible, tokens only.
- [ ] **Mobile:** works at 375 px with Spanish-length text (+20%) without overflow.
- [ ] **Desktop:** works at 1280 px.

## Decisions

- **Yes:** purely presentational components with text as props. Keeps M1.3 independent of M1.5 and avoids hardcoded strings.
- **Yes:** `tone` is a prop on `BookCover`. M1.4 adds the deterministic hash in `packages/shared`; callers then pass its result.
- **No:** reimplementing `Rating` conversions inside the components. Callers pass `formatted` to `RatingDisplay`; `RatingInput` only works in 0–100 with fixed steps. M1.4 owns formatting and parsing rules.
- **Yes:** `BookStatus` is defined locally in `apps/web`. The shared enum arrives with M4.1; moving it is a one-line import change.
- **Yes:** dev-only demo page at `/dev/components`. It gives a place to check every state in light and dark before M1's "Done when" demo. It is removed or promoted when M1.6 ships.
- **Yes:** Testing Library, jsdom and the React plugin as dev dependencies. ARCHITECTURE.md §12 requires component tests. Each gets a one-line reason in the PR.
- **No:** Storybook. Extra tooling for a five-user project; the demo page is enough.
- **Yes:** quick definition without detailed clarification questions (requested "short"). Choices come from `ARCHITECTURE.md` §4, §6, §12 and `docs/DESIGN.md` (covers, rating, progress, privacy, states).

## Risks

| Risk | Mitigation |
| ---- | ---------- |
| Quarter-star hit areas are small on mobile | Star picker also supports keyboard arrows and a pointer-position calculation; the field/slider fallback is not used for star styles, so verify touch at 375 px in the demo |
| Local props (`tone`, `RatingStyle`) drift from the future shared types | M1.4 replaces `types.ts` with imports from `@verso/shared`; typecheck catches mismatches |
| `radix-ui` Tooltip needs a provider for `LockToggle` | Reuse the provider already used by `components/ui/tooltip.tsx`; add it to the demo page layout if missing |

## What is **not** in this spec

- `Rating` and `GeneratedCover` logic in `packages/shared`.
- next-intl, message catalogs and any translated copy.
- API calls, queries, mutations or routing.
- Library grid cards, hover overlay and the app shell.
- Tests for the components other than RatingInput and ProgressBar.
