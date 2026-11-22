import { AVATAR_CONTENT_TYPE, signedUploadSchema } from '@verso/shared';
import { api } from '@/lib/api-client';

/**
 * Asks the API for a signed upload url, sends the file straight to storage, and returns the
 * object path. The caller then saves it with `PATCH /v1/me { avatarPath }`.
 */
export async function uploadAvatar(blob: Blob): Promise<string> {
  const signed = await api.post('/api/v1/me/avatar/upload-url', signedUploadSchema, {
    contentType: AVATAR_CONTENT_TYPE,
    size: blob.size,
  });

  const response = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': AVATAR_CONTENT_TYPE },
    body: blob,
  });
  if (!response.ok) throw new Error(`Avatar upload failed with status ${response.status}`);

  return signed.path;
}
