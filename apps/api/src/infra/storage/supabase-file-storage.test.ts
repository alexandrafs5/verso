import { describe, expect, it, vi } from 'vitest';
import type { FileStorage } from './file-storage.js';
import { SupabaseFileStorage } from './supabase-file-storage.js';

const URL_BASE = 'https://abc.supabase.co';

function storageWith(response: Response) {
  const fetchMock = vi.fn(async () => response);
  const storage: FileStorage = new SupabaseFileStorage(`${URL_BASE}/`, 'secret', 'verso', fetchMock);
  return { storage, fetchMock };
}

describe('SupabaseFileStorage', () => {
  it('builds public urls under the bucket', () => {
    const { storage } = storageWith(new Response(null));
    expect(storage.publicUrl('avatars/u1/a.webp')).toBe(
      `${URL_BASE}/storage/v1/object/public/verso/avatars/u1/a.webp`,
    );
  });

  it('uses only the origin of SUPABASE_URL, so a pasted Data API url still reaches Storage', async () => {
    const fetchMock = vi.fn(async () => Response.json({ url: '/object/upload/sign/verso/a.webp?token=tok' }));
    const storage: FileStorage = new SupabaseFileStorage(`${URL_BASE}/rest/v1/`, 'secret', 'verso', fetchMock);
    expect(storage.publicUrl('a.webp')).toBe(`${URL_BASE}/storage/v1/object/public/verso/a.webp`);
    await storage.createUploadUrl('a.webp', 'image/webp');
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(`${URL_BASE}/storage/v1/object/upload/sign/verso/a.webp`);
  });

  it('requests a signed upload url and returns the absolute url and token', async () => {
    const { storage, fetchMock } = storageWith(
      Response.json({ url: '/object/upload/sign/verso/avatars/u1/a.webp?token=tok' }),
    );
    const upload = await storage.createUploadUrl('avatars/u1/a.webp', 'image/webp');

    expect(upload).toEqual({
      path: 'avatars/u1/a.webp',
      uploadUrl: `${URL_BASE}/storage/v1/object/upload/sign/verso/avatars/u1/a.webp?token=tok`,
      token: 'tok',
    });
    const [calledUrl, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(`${URL_BASE}/storage/v1/object/upload/sign/verso/avatars/u1/a.webp`);
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer secret');
  });

  it('fails with the status only when signing is rejected', async () => {
    const { storage } = storageWith(new Response('nope secret', { status: 401 }));
    const error = await storage.createUploadUrl('avatars/u1/a.webp', 'image/webp').catch((e) => e);
    expect(error.message).toBe('Supabase signed upload failed with status 401');
  });

  it('fails when the response has no token', async () => {
    const { storage } = storageWith(Response.json({ url: '/object/upload/sign/verso/x' }));
    await expect(storage.createUploadUrl('x', 'image/webp')).rejects.toThrow(/no token/);
  });

  it('deletes through DELETE and treats 404 as done', async () => {
    const ok = storageWith(new Response('{}'));
    await ok.storage.delete('avatars/u1/a.webp');
    const [calledUrl, init] = ok.fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(calledUrl).toBe(`${URL_BASE}/storage/v1/object/verso/avatars/u1/a.webp`);
    expect(init.method).toBe('DELETE');

    const missing = storageWith(new Response('{}', { status: 404 }));
    await expect(missing.storage.delete('x')).resolves.toBeUndefined();
  });

  it('fails when delete returns a server error', async () => {
    const { storage } = storageWith(new Response('{}', { status: 500 }));
    await expect(storage.delete('x')).rejects.toThrow('Supabase delete failed with status 500');
  });
});
