import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESEND_UNTIL_KEY, useResendCooldown } from './use-resend-cooldown';

describe('useResendCooldown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('starts with no cooldown', () => {
    const { result } = renderHook(() => useResendCooldown());
    expect(result.current.secondsLeft).toBe(0);
  });

  it('counts down 60 seconds after start', () => {
    const { result } = renderHook(() => useResendCooldown());
    act(() => result.current.start());
    expect(result.current.secondsLeft).toBe(60);

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current.secondsLeft).toBe(59);

    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    expect(result.current.secondsLeft).toBe(0);
  });

  it('stores the end timestamp and keeps the countdown after a reload', () => {
    const first = renderHook(() => useResendCooldown());
    act(() => first.result.current.start());
    expect(window.sessionStorage.getItem(RESEND_UNTIL_KEY)).not.toBeNull();
    first.unmount();

    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    const second = renderHook(() => useResendCooldown());
    expect(second.result.current.secondsLeft).toBe(40);
  });

  it('ignores an expired stored timestamp', () => {
    window.sessionStorage.setItem(RESEND_UNTIL_KEY, String(Date.now() - 5000));
    const { result } = renderHook(() => useResendCooldown());
    expect(result.current.secondsLeft).toBe(0);
  });

  it('still counts down when sessionStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const { result } = renderHook(() => useResendCooldown());
    act(() => result.current.start());
    expect(result.current.secondsLeft).toBe(60);
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(result.current.secondsLeft).toBe(50);
  });
});
