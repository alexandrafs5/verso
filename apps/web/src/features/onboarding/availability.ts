import { type UsernameAvailability, usernameAvailabilitySchema } from '@verso/shared';
import { api } from '@/lib/api-client';

export const AVAILABILITY_STALE_MS = 30_000;

export function fetchAvailability(
  username: string,
  signal?: AbortSignal,
): Promise<UsernameAvailability> {
  return api.get(
    `/api/v1/usernames/${encodeURIComponent(username)}/availability`,
    usernameAvailabilitySchema,
    { signal },
  );
}
