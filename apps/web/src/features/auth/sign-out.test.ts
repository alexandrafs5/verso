import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { signOutAndLeave } from './sign-out';

const mocks = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { signOut: mocks.signOut } }));

const assign = vi.fn();

beforeEach(() => {
  assign.mockReset();
  mocks.signOut.mockReset().mockResolvedValue({});
  vi.stubGlobal('location', { assign });
});
afterEach(() => vi.unstubAllGlobals());

describe('signOutAndLeave', () => {
  it('signs out, then loads /sign-in with a full page load', async () => {
    const order: string[] = [];
    mocks.signOut.mockImplementation(async () => void order.push('signOut'));
    assign.mockImplementation(() => void order.push('assign'));

    await signOutAndLeave();

    expect(order).toEqual(['signOut', 'assign']);
    expect(assign).toHaveBeenCalledWith('/sign-in');
  });

  it('still leaves when the sign-out request fails', async () => {
    mocks.signOut.mockRejectedValue(new Error('offline'));
    await expect(signOutAndLeave()).rejects.toThrow('offline');
    expect(assign).toHaveBeenCalledWith('/sign-in');
  });
});
