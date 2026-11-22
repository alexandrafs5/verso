import { describe, expect, it } from 'vitest';
import { InMemoryFileStorage } from './in-memory-file-storage.js';

describe('InMemoryFileStorage', () => {
  it('records upload requests and returns a signed upload for the same path', async () => {
    const storage = new InMemoryFileStorage();
    const upload = await storage.createUploadUrl('avatars/u1/a.webp', 'image/webp');
    expect(upload.path).toBe('avatars/u1/a.webp');
    expect(upload.uploadUrl).toContain('avatars/u1/a.webp');
    expect(storage.uploadRequests).toEqual([
      { path: 'avatars/u1/a.webp', contentType: 'image/webp' },
    ]);
  });

  it('records deletes and builds public urls', async () => {
    const storage = new InMemoryFileStorage();
    await storage.delete('avatars/u1/a.webp');
    expect(storage.deleted).toEqual(['avatars/u1/a.webp']);
    expect(storage.publicUrl('avatars/u1/a.webp')).toContain('avatars/u1/a.webp');
  });

  it('rejects when failWith is set, and clear resets it', async () => {
    const storage = new InMemoryFileStorage();
    storage.failWith = new Error('boom');
    await expect(storage.delete('x')).rejects.toThrow('boom');
    await expect(storage.createUploadUrl('x', 'image/webp')).rejects.toThrow('boom');
    storage.clear();
    await expect(storage.delete('x')).resolves.toBeUndefined();
  });
});
