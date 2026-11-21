import { describe, expect, it } from 'vitest';
import { RATING_STYLES, Rating, ratingStyleSchema, type RatingStyle } from './rating.js';

describe('ratingStyleSchema', () => {
  it('accepts every known style', () => {
    for (const style of RATING_STYLES) {
      expect(ratingStyleSchema.safeParse(style).success).toBe(true);
    }
  });

  it('rejects unknown values', () => {
    expect(ratingStyleSchema.safeParse('STARS_THIRD').success).toBe(false);
  });
});

describe('Rating.of', () => {
  it('accepts integers 0-100', () => {
    expect(Rating.of(0).value).toBe(0);
    expect(Rating.of(73).value).toBe(73);
    expect(Rating.of(100).value).toBe(100);
  });

  it.each([101, -1, 50.5, NaN, Infinity])('throws RangeError for %s', (value) => {
    expect(() => Rating.of(value)).toThrow(RangeError);
  });
});

describe('Rating.fromInput', () => {
  it('converts stars and snaps to the style step', () => {
    expect(Rating.fromInput('STARS_HALF', 3.5).value).toBe(70);
    expect(Rating.fromInput('STARS_WHOLE', 3.5).value).toBe(80);
    expect(Rating.fromInput('STARS_WHOLE', 3.4).value).toBe(60);
    expect(Rating.fromInput('STARS_QUARTER', 3.25).value).toBe(65);
    expect(Rating.fromInput('STARS_QUARTER', 3.3).value).toBe(65);
  });

  it('converts decimal and hundred inputs', () => {
    expect(Rating.fromInput('DECIMAL_10', 7.3).value).toBe(73);
    expect(Rating.fromInput('DECIMAL_10', 7.34).value).toBe(73);
    expect(Rating.fromInput('HUNDRED', 73).value).toBe(73);
    expect(Rating.fromInput('HUNDRED', 72.6).value).toBe(73);
  });

  it('clamps out-of-range input', () => {
    expect(Rating.fromInput('HUNDRED', 150).value).toBe(100);
    expect(Rating.fromInput('HUNDRED', -5).value).toBe(0);
    expect(Rating.fromInput('STARS_WHOLE', 9).value).toBe(100);
    expect(Rating.fromInput('DECIMAL_10', -1).value).toBe(0);
  });

  it.each([NaN, Infinity, -Infinity])('throws RangeError for non-finite input %s', (input) => {
    expect(() => Rating.fromInput('HUNDRED', input)).toThrow(RangeError);
  });
});

describe('Rating.format', () => {
  it('formats stars with trailing zeros trimmed', () => {
    expect(Rating.of(60).format('STARS_WHOLE')).toBe('3');
    expect(Rating.of(70).format('STARS_HALF')).toBe('3.5');
    expect(Rating.of(50).format('STARS_HALF')).toBe('2.5');
    expect(Rating.of(65).format('STARS_QUARTER')).toBe('3.25');
    expect(Rating.of(0).format('STARS_WHOLE')).toBe('0');
    expect(Rating.of(100).format('STARS_QUARTER')).toBe('5');
  });

  it('formats decimal with one decimal', () => {
    expect(Rating.of(73).format('DECIMAL_10')).toBe('7.3');
    expect(Rating.of(70).format('DECIMAL_10')).toBe('7.0');
    expect(Rating.of(100).format('DECIMAL_10')).toBe('10.0');
  });

  it('formats hundred as an integer', () => {
    expect(Rating.of(73).format('HUNDRED')).toBe('73');
  });

  it('rounds values finer than the style step', () => {
    expect(Rating.of(73).format('STARS_HALF')).toBe('3.5');
    expect(Rating.of(73).format('STARS_WHOLE')).toBe('4');
    expect(Rating.of(73).format('STARS_QUARTER')).toBe('3.75');
  });

  it('round-trips through fromInput for values on the style step', () => {
    const steps: Record<RatingStyle, number> = {
      STARS_WHOLE: 20,
      STARS_HALF: 10,
      STARS_QUARTER: 5,
      DECIMAL_10: 1,
      HUNDRED: 1,
    };
    for (const style of RATING_STYLES) {
      for (let v = 0; v <= 100; v += steps[style]) {
        const r = Rating.of(v);
        expect(Rating.fromInput(style, parseFloat(r.format(style))).value).toBe(v);
      }
    }
  });
});
