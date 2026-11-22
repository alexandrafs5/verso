export type SignedUpload = {
  /** Object path inside the bucket. */
  path: string;
  /** Full URL the client sends a PUT to. */
  uploadUrl: string;
  token: string;
};

export interface FileStorage {
  createUploadUrl(path: string, contentType: string): Promise<SignedUpload>;
  delete(path: string): Promise<void>;
  publicUrl(path: string): string;
}

export const FILE_STORAGE = Symbol('FILE_STORAGE');

/** Thrown when storage is used without Supabase configured. Boot never fails on it. */
export class StorageNotConfiguredError extends Error {
  constructor() {
    super('File storage is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    this.name = 'StorageNotConfiguredError';
  }
}
