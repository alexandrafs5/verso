import { Global, Module } from '@nestjs/common';
import { FILE_STORAGE, type FileStorage, StorageNotConfiguredError } from './file-storage.js';
import { loadStorageEnv, type StorageEnv } from './storage-env.js';
import { SupabaseFileStorage } from './supabase-file-storage.js';

/** Fails on use, not at boot, so the API runs without Supabase (tests, local dev). */
class UnconfiguredFileStorage implements FileStorage {
  createUploadUrl(): Promise<never> {
    return Promise.reject(new StorageNotConfiguredError());
  }
  delete(): Promise<never> {
    return Promise.reject(new StorageNotConfiguredError());
  }
  publicUrl(): never {
    throw new StorageNotConfiguredError();
  }
}

export function createFileStorage(env: StorageEnv): FileStorage {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return new UnconfiguredFileStorage();
  return new SupabaseFileStorage(
    env.SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    env.SUPABASE_BUCKET,
  );
}

@Global()
@Module({
  providers: [{ provide: FILE_STORAGE, useFactory: () => createFileStorage(loadStorageEnv()) }],
  exports: [FILE_STORAGE],
})
export class StorageModule {}
