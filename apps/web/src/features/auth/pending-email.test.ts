import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingEmail,
  getPendingEmail,
  PENDING_EMAIL_KEY,
  setPendingEmail,
} from './pending-email';

describe('pending-email', () => {
  afterEach(() => {
    clearPendingEmail();
    vi.restoreAllMocks();
  });

  it('returns null when nothing is stored', () => {
    expect(getPendingEmail()).toBeNull();
  });

  it('stores and reads the email in sessionStorage', () => {
    setPendingEmail('ana@example.com');
    expect(window.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBe('ana@example.com');
    expect(getPendingEmail()).toBe('ana@example.com');
  });

  it('clears the email', () => {
    setPendingEmail('ana@example.com');
    clearPendingEmail();
    expect(window.sessionStorage.getItem(PENDING_EMAIL_KEY)).toBeNull();
    expect(getPendingEmail()).toBeNull();
  });

  it('falls back to memory when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => setPendingEmail('ana@example.com')).not.toThrow();
    expect(getPendingEmail()).toBe('ana@example.com');
  });
});
