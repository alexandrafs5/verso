import { ErrorCode } from '@verso/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, api } from './api-client';

const schema = z.object({ status: z.literal('ok') });

function jsonResponse(body: unknown, status = 200, contentType = 'application/json'): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': contentType } });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api.get without retries', () => {
  it('returns parsed data on success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/api/health', schema)).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws ApiError with code and problem on problem+json', async () => {
    const problem = {
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: ErrorCode.NOT_FOUND,
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse(problem, 404, 'application/problem+json')),
    );

    const error = await api.get('/api/nope', schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 404, code: ErrorCode.NOT_FOUND, problem });
  });

  it('throws ApiError with code null when an error body is not problem+json', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('oops', { status: 400 })));

    const error = await api.get('/api/x', schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, code: null, problem: null });
  });

  it('throws ApiError with code null when the body does not match the schema', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ status: 'down' })));

    const error = await api.get('/api/health', schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 200, code: null, problem: null });
  });

  it('wraps network errors in ApiError with status 0', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const error = await api.get('/api/health', schema).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: null });
  });
});
