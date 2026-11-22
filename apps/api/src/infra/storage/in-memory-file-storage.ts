import type { FileStorage, SignedUpload } from './file-storage.js';

export const FAKE_STORAGE_BASE_URL = 'https://storage.test';

/** Test fake: records calls instead of talking to Supabase. */
export class InMemoryFileStorage implements FileStorage {
  readonly uploadRequests: { path: string; contentType: string }[] = [];
  readonly deleted: string[] = [];
  failWith: Error | null = null;

  async createUploadUrl(path: string, contentType: string): Promise<SignedUpload> {
    if (this.failWith) throw this.failWith;
    this.uploadRequests.push({ path, contentType });
    return { path, uploadUrl: `${FAKE_STORAGE_BASE_URL}/upload/${path}?token=fake`, token: 'fake' };
  }

  async delete(path: string): Promise<void> {
    if (this.failWith) throw this.failWith;
    this.deleted.push(path);
  }

  publicUrl(path: string): string {
    return `${FAKE_STORAGE_BASE_URL}/public/${path}`;
  }

  clear(): void {
    this.uploadRequests.length = 0;
    this.deleted.length = 0;
    this.failWith = null;
  }
}
