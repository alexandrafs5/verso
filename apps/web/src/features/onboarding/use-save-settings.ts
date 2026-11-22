'use client';

import type { UpdateSettingsInput } from '@verso/shared';
import { useUpdateSettings } from '@/features/me/use-me';

/**
 * Saves a settings patch and runs `onSaved` on success. A failure leaves the step in place with
 * `failed` set, and calling `save` again retries.
 */
export function useSaveSettings(onSaved: () => void) {
  const mutation = useUpdateSettings();

  function save(patch: UpdateSettingsInput) {
    mutation.mutate(patch, { onSuccess: onSaved });
  }

  return { save, pending: mutation.isPending, failed: mutation.isError };
}
