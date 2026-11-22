import type { FileStorage, SignedUpload } from './file-storage.js';

const TIMEOUT_MS = 10_000;

type FetchLike = typeof fetch;

const encodePath = (path: string): string => path.split('/').map(encodeURIComponent).join('/');

/** Supabase Storage through its REST API (no SDK dependency). The bucket is public. */
export class SupabaseFileStorage implements FileStorage {
  private readonly base: string;

  constructor(
    url: string,
    private readonly serviceRoleKey: string,
    private readonly bucket: string,
    private readonly fetchImpl: FetchLike = fetch,
  ) {
    // Only the origin counts: a pasted Data API url (.../rest/v1/) must still reach Storage.
    this.base = `${new URL(url).origin}/storage/v1`;
  }

  async createUploadUrl(path: string): Promise<SignedUpload> {
    const response = await this.fetchImpl(
      `${this.base}/object/upload/sign/${this.bucket}/${encodePath(path)}`,
      {
        method: 'POST',
        headers: this.headers(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    if (!response.ok)
      throw new Error(`Supabase signed upload failed with status ${response.status}`);

    const body = (await response.json()) as { url?: string };
    if (!body.url) throw new Error('Supabase signed upload returned no url');
    const uploadUrl = `${this.base}${body.url}`;
    const token = new URL(uploadUrl).searchParams.get('token');
    if (!token) throw new Error('Supabase signed upload returned no token');
    return { path, uploadUrl, token };
  }

  async delete(path: string): Promise<void> {
    const response = await this.fetchImpl(
      `${this.base}/object/${this.bucket}/${encodePath(path)}`,
      {
        method: 'DELETE',
        headers: this.headers(),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      },
    );
    // A missing object is already the desired state.
    if (!response.ok && response.status !== 404) {
      throw new Error(`Supabase delete failed with status ${response.status}`);
    }
  }

  publicUrl(path: string): string {
    return `${this.base}/object/public/${this.bucket}/${encodePath(path)}`;
  }

  private headers(): Record<string, string> {
    // Status only in errors: the key and the object path never go into messages.
    return { authorization: `Bearer ${this.serviceRoleKey}`, apikey: this.serviceRoleKey };
  }
}
