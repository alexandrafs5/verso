import { describe, expect, it } from 'vitest';
import { AUTH_QUOTES, pickQuote } from './quotes';

describe('AUTH_QUOTES', () => {
  it('has at least 12 quotes with text and author', () => {
    expect(AUTH_QUOTES.length).toBeGreaterThanOrEqual(12);
    for (const quote of AUTH_QUOTES) {
      expect(quote.text.trim()).not.toBe('');
      expect(quote.author.trim()).not.toBe('');
    }
  });

  it('has no duplicate texts', () => {
    expect(new Set(AUTH_QUOTES.map((q) => q.text)).size).toBe(AUTH_QUOTES.length);
  });
});

describe('pickQuote', () => {
  it('returns the first quote when random is 0', () => {
    expect(pickQuote(() => 0)).toBe(AUTH_QUOTES[0]);
  });

  it('returns the last quote when random is just below 1', () => {
    expect(pickQuote(() => 0.999999)).toBe(AUTH_QUOTES[AUTH_QUOTES.length - 1]);
  });

  it('never goes out of range even if random returns 1', () => {
    expect(pickQuote(() => 1)).toBe(AUTH_QUOTES[AUTH_QUOTES.length - 1]);
  });

  it('picks by index from the random value', () => {
    expect(pickQuote(() => 2.5 / AUTH_QUOTES.length)).toBe(AUTH_QUOTES[2]);
  });
});
