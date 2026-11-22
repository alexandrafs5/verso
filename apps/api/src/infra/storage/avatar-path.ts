import { randomUUID } from 'node:crypto';

const AVATAR_ROOT = 'avatars';

/** The API builds avatar paths; the client never chooses one. */
export function buildAvatarPath(userId: string, id: string = randomUUID()): string {
  return `${AVATAR_ROOT}/${userId}/${id}.webp`;
}

/** True only for `avatars/{userId}/{name}.webp` with a single safe path segment after the user folder. */
export function isAvatarPathOwnedBy(userId: string, path: string): boolean {
  const prefix = `${AVATAR_ROOT}/${userId}/`;
  if (!path.startsWith(prefix)) return false;
  return /^[A-Za-z0-9-]+\.webp$/.test(path.slice(prefix.length));
}
