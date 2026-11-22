import { describe, expect, it } from 'vitest';
import { buildAvatarPath, isAvatarPathOwnedBy } from './avatar-path.js';

describe('buildAvatarPath', () => {
  it('builds avatars/{userId}/{uuid}.webp', () => {
    expect(buildAvatarPath('user-1', 'abc')).toBe('avatars/user-1/abc.webp');
  });

  it('generates a different path on every call', () => {
    expect(buildAvatarPath('user-1')).not.toBe(buildAvatarPath('user-1'));
  });

  it('builds a path the owner check accepts', () => {
    expect(isAvatarPathOwnedBy('user-1', buildAvatarPath('user-1'))).toBe(true);
  });
});

describe('isAvatarPathOwnedBy', () => {
  it('accepts a path under the own folder', () => {
    expect(isAvatarPathOwnedBy('user-1', 'avatars/user-1/abc-123.webp')).toBe(true);
  });

  it("rejects another user's folder", () => {
    expect(isAvatarPathOwnedBy('user-1', 'avatars/user-2/abc.webp')).toBe(false);
  });

  it('rejects a folder that only shares a prefix with the user id', () => {
    expect(isAvatarPathOwnedBy('user-1', 'avatars/user-10/abc.webp')).toBe(false);
  });

  it('rejects traversal, nested paths and other extensions', () => {
    expect(isAvatarPathOwnedBy('user-1', 'avatars/user-1/../user-2/abc.webp')).toBe(false);
    expect(isAvatarPathOwnedBy('user-1', 'avatars/user-1/a/b.webp')).toBe(false);
    expect(isAvatarPathOwnedBy('user-1', 'avatars/user-1/abc.png')).toBe(false);
    expect(isAvatarPathOwnedBy('user-1', 'covers/user-1/abc.webp')).toBe(false);
  });
});
