# SPEC 04 — Rating and GeneratedCover in shared (M1.4)

> **Status:** Implemented
> **Depends on:** SPEC 03
> **Date:** 2026-11-21
> **Objective:** Add the `Rating` value object and the `GeneratedCover` tone picker to `packages/shared`, with unit tests, so web and API convert and choose identically.

## Why this spec exists

SPEC 03 left `RatingStyle` and `CoverTone` as local types in `apps/web` and made components take pre-formatted values and an explicit `tone`. M1.4 owns the logic behind those props (ARCHITECTURE §6, ADR-005). Callers wire it later (M2.5, M4.x).

## Scope

**In:**

- `packages/shared/src/rating.ts`: `RatingStyle` Zod enum and `Rating` value object.
- `packages/shared/src/generated-cover.ts`: `COVER_TONES`, `CoverTone` type and `pickCoverTone(title)`.
- Unit tests: `rating.test.ts`, `generated-cover.test.ts`.
- Exports from `packages/shared/src/index.ts`.
- `apps/web/src/components/verso/types.ts` re-exports `RatingStyle` and `CoverTone` from `@verso/shared` (replaces the local definitions; `BookStatus` stays local).

**Out of scope (for future specs):**

- Wiring `Rating` into components or screens (M2.5 onboarding, M4.x, M5.4).
- Settings schema or API field for rating style (M2.5).
- i18n of decimal separators (M1.5). `format` always uses a dot.
- Changing component behavior from SPEC 03.
- `Progress`, `StreakCalculator` (M5.1).

## Data model

```ts
// rating.ts
export const RATING_STYLES = [
  'STARS_WHOLE',
  'STARS_HALF',
  'STARS_QUARTER',
  'DECIMAL_10',
  'HUNDRED',
] as const;
export type RatingStyle = (typeof RATING_STYLES)[number];
export const ratingStyleSchema = z.enum(RATING_STYLES);

export class Rating {
  readonly value: number; // integer 0-100
  static of(value: number): Rating; // throws RangeError if not integer 0-100
  static fromInput(style: RatingStyle, input: number): Rating; // snaps and clamps
  format(style: RatingStyle): string;
}

// generated-cover.ts
export const COVER_TONES = ['wine', 'tobacco', 'forest', 'navy', 'oxblood', 'slate'] as const;
export type CoverTone = (typeof COVER_TONES)[number];
export function pickCoverTone(title: string): CoverTone;
```

Conventions:

- Stored value is an integer 0–100 (ADR-005). "No rating" is `null` at the caller, never a `Rating`.
- Input units per style: stars styles take stars (`3.5`), `DECIMAL_10` takes 1–10 (`7.3`), `HUNDRED` takes 1–100 (`73`).
- `fromInput` multiplies to 0–100 (stars × 20, decimal × 10, hundred × 1), rounds to the style step (whole 20, half 10, quarter 5, decimal 1, hundred 1) and clamps to 0–100. Non-finite input throws `RangeError`.
- `format`: stars styles give stars with trailing zeros trimmed (`60` → `"3"`, `50` → `"2.5"`, `65` → `"3.25"`); `DECIMAL_10` gives one decimal (`73` → `"7.3"`, `70` → `"7.0"`); `HUNDRED` gives the integer (`"73"`). Formatting a value finer than the style step rounds to that step first (`73` as `STARS_HALF` → `"3.5"`).
- `pickCoverTone`: trim and lowercase the title, FNV-1a 32-bit hash, index `hash % 6` into `COVER_TONES`. Empty title maps to `COVER_TONES[0]`.

## Implementation plan

1. Create `rating.ts` with `RATING_STYLES`, schema, `Rating.of`, `Rating.fromInput`. Export from `index.ts`. Verify: `pnpm --filter @verso/shared typecheck`.
2. Add `Rating.format` and `rating.test.ts` (conversions, snapping, clamping, formatting, invalid input).
3. Create `generated-cover.ts` and `generated-cover.test.ts`. Export from `index.ts`.
4. Replace local `RatingStyle` and `CoverTone` in `apps/web/src/components/verso/types.ts` with re-exports from `@verso/shared`. Verify: `pnpm --filter @verso/web typecheck` and tests pass.
5. Tick M1.4 in `ROADMAP.md`. Run `pnpm lint && pnpm typecheck && pnpm test`.

## Acceptance criteria

- [x] `Rating.of(101)`, `Rating.of(-1)` and `Rating.of(50.5)` throw `RangeError`.
- [x] `Rating.fromInput('STARS_HALF', 3.5).value` is `70`; `fromInput('STARS_WHOLE', 3.5).value` is `80` (snaps to step 20, rounds half up).
- [x] `Rating.fromInput('STARS_QUARTER', 3.25).value` is `65`.
- [x] `Rating.fromInput('DECIMAL_10', 7.3).value` is `73`; `fromInput('HUNDRED', 73).value` is `73`.
- [x] `fromInput` clamps: `('HUNDRED', 150)` gives `100`; `('HUNDRED', -5)` gives `0`.
- [x] `fromInput` with `NaN` throws `RangeError`.
- [x] `Rating.of(70).format('STARS_HALF')` is `"3.5"`; `of(60).format('STARS_WHOLE')` is `"3"`; `of(65).format('STARS_QUARTER')` is `"3.25"`.
- [x] `Rating.of(73).format('DECIMAL_10')` is `"7.3"`; `of(70).format('DECIMAL_10')` is `"7.0"`; `of(73).format('HUNDRED')` is `"73"`.
- [x] For every style, `fromInput(style, parseFloat(r.format(style))).value` equals `r.value` when `r.value` is a multiple of the style step.
- [x] `pickCoverTone` returns the same tone for the same title on repeated calls, ignoring case and surrounding spaces.
- [x] `pickCoverTone` returns only members of `COVER_TONES`, and a sample of 200 distinct titles uses all six tones.
- [x] `pickCoverTone('')` returns `'wine'`.
- [x] `apps/web` has no local definition of `RatingStyle` or `CoverTone`; typecheck passes.
- [x] Coverage of `rating.ts` and `generated-cover.ts` is at least 90% lines.
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass.
- [x] The M1.4 checkbox in `ROADMAP.md` is ticked in the same PR.

UI states: N/A, this spec touches no screen or component behavior.

## Decisions

- **Yes:** `Rating` is a class with a static factory, as in ARCHITECTURE §6. Invalid state cannot exist after construction.
- **Yes:** `RatingStyle` and `CoverTone` live in `packages/shared` (Zod enum for rating style). The settings schema in M2.5 reuses the enum.
- **Yes:** stars styles format as a number of stars (`"3.5"`), not glyphs. `RatingDisplay` already draws the stars; the text is for labels and screen readers.
- **Yes:** `fromInput` snaps and clamps instead of throwing on out-of-range. Typing in a field should never crash; only non-finite input is a programmer error.
- **Yes:** FNV-1a 32-bit for the cover hash. Tiny, dependency-free, stable across Node and browser.
- **No:** `Intl.NumberFormat` in `format`. Locale-aware decimals arrive with M1.5; shared must stay locale-free so API and web match.
- **No:** `null` handling inside `Rating`. Absence is represented by the caller.
- **No:** moving `BookStatus` now. It moves with M4.1.
- **Yes:** quick definition without detailed clarification questions (requested "short"). Formats and edge cases come from ARCHITECTURE §6, ADR-005 and DESIGN.md (Ratings, Generated covers); the half-up rounding, FNV-1a and dot-decimal choices are mine and unconfirmed.

## What is **not** in this spec

- Wiring `Rating` or `pickCoverTone` into screens, settings or API.
- Locale-aware number formatting.
- `Progress`, `StreakCalculator` or any API-side domain class.
- Changes to the SPEC 03 components beyond importing the shared types.
