import { z } from 'zod';

export const RATING_STYLES = [
  'STARS_WHOLE',
  'STARS_HALF',
  'STARS_QUARTER',
  'DECIMAL_10',
  'HUNDRED',
] as const;

export type RatingStyle = (typeof RATING_STYLES)[number];

export const ratingStyleSchema = z.enum(RATING_STYLES);

const MIN_VALUE = 0;
const MAX_VALUE = 100;

/** Multiplier from the style's input unit to the stored 0-100 scale. */
const INPUT_FACTOR: Record<RatingStyle, number> = {
  STARS_WHOLE: 20,
  STARS_HALF: 20,
  STARS_QUARTER: 20,
  DECIMAL_10: 10,
  HUNDRED: 1,
};

/** Granularity of each style on the stored 0-100 scale. */
const STEP: Record<RatingStyle, number> = {
  STARS_WHOLE: 20,
  STARS_HALF: 10,
  STARS_QUARTER: 5,
  DECIMAL_10: 1,
  HUNDRED: 1,
};

export class Rating {
  /** Integer 0-100 (ADR-005). */
  readonly value: number;

  private constructor(value: number) {
    this.value = value;
  }

  static of(value: number): Rating {
    if (!Number.isInteger(value) || value < MIN_VALUE || value > MAX_VALUE) {
      throw new RangeError(`Rating must be an integer between 0 and 100, got ${value}`);
    }
    return new Rating(value);
  }

  /** Converts user input in the style's unit; snaps to the style step (half up) and clamps. */
  static fromInput(style: RatingStyle, input: number): Rating {
    if (!Number.isFinite(input)) {
      throw new RangeError(`Rating input must be a finite number, got ${input}`);
    }
    const step = STEP[style];
    const scaled = input * INPUT_FACTOR[style];
    const snapped = Math.round(scaled / step) * step;
    return new Rating(Math.min(MAX_VALUE, Math.max(MIN_VALUE, snapped)));
  }

  /** Locale-free text (always a dot). Values finer than the style step round to that step first. */
  format(style: RatingStyle): string {
    const step = STEP[style];
    const snapped = Math.round(this.value / step) * step;
    switch (style) {
      case 'DECIMAL_10':
        return (snapped / 10).toFixed(1);
      case 'HUNDRED':
        return String(snapped);
      default:
        // Stars: 20 points per star; at most two decimals (quarter step). Number() trims trailing zeros.
        return String(Number((snapped / 20).toFixed(2)));
    }
  }
}
