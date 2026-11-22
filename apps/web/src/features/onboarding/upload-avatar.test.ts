import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, problem } from './test-utils';
import { uploadAvatar } from './upload-avatar';

afterEach(() => vi.unstubAllGlobals());

const signed = { path: 'avatars/u1/a.webp', uploadUrl: 'https://s.test/up?token=t', token: 't' };
const blob = new Blob(['12345'], { type: 'image/webp' });

describe('uploadAvatar', () => {
  it('requests a signed url, PUTs the blob to it and returns the path', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(signed))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(uploadAvatar(blob)).resolves.toBe('avatars/u1/a.webp');

    const [signUrl, signInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(signUrl).toBe('/api/v1/me/avatar/upload-url');
    expect(JSON.parse(String(signInit.body))).toEqual({ contentType: 'image/webp', size: 5 });
    const [putUrl, putInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(putUrl).toBe(signed.uploadUrl);
    expect(putInit).toMatchObject({ method: 'PUT', body: blob });
  });

  it('fails when storage rejects the upload', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(json(signed))
        .mockResolvedValueOnce(new Response(null, { status: 403 })),
    );
    await expect(uploadAvatar(blob)).rejects.toThrow('status 403');
  });

  it('fails without calling storage when the API refuses to sign', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(problem(503, 'STORAGE_UNAVAILABLE'));
    vi.stubGlobal('fetch', fetchMock);
    await expect(uploadAvatar(blob)).rejects.toMatchObject({ status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
