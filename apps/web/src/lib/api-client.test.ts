import { ErrorCode } from '@verso/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ApiError, api, request } from './api-client';
import { getSnapshot } from './waking-state';

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

  it('wraps network errors in ApiError with status 0 once the retry budget is spent', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));

    const pending = api.get('/api/health', schema).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(75_000);

    const error = await pending;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 0, code: null });
    vi.useRealTimers();
  });
});

describe('api.get retries and waking state', () => {
  const problem503 = () =>
    jsonResponse(
      { type: 'about:blank', title: 'Unavailable', status: 503, code: ErrorCode.INTERNAL_ERROR },
      503,
      'application/problem+json',
    );

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sets waking after 3 s and returns to idle when the request ends', async () => {
    vi.useFakeTimers();
    let finish!: (r: Response) => void;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockReturnValue(new Promise<Response>((resolve) => (finish = resolve))),
    );

    const pending = api.get('/api/health', schema);
    expect(getSnapshot()).toBe('idle');
    await vi.advanceTimersByTimeAsync(2_999);
    expect(getSnapshot()).toBe('idle');
    await vi.advanceTimersByTimeAsync(1);
    expect(getSnapshot()).toBe('waking');

    finish(jsonResponse({ status: 'ok' }));
    await expect(pending).resolves.toEqual({ status: 'ok' });
    expect(getSnapshot()).toBe('idle');
  });

  it('retries a 503 then resolves with the data', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(problem503())
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = api.get('/api/health', schema);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(getSnapshot()).toBe('waking');
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(pending).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getSnapshot()).toBe('idle');
  });

  it('backs off 1 s, 2 s, 4 s, then 8 s capped', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(problem503()));
    vi.stubGlobal('fetch', fetchMock);

    const pending = api.get('/api/health', schema).catch((e: unknown) => e);
    const calls = async (afterMs: number) => {
      await vi.advanceTimersByTimeAsync(afterMs);
      return fetchMock.mock.calls.length;
    };
    expect(await calls(0)).toBe(1);
    expect(await calls(999)).toBe(1);
    expect(await calls(1)).toBe(2); // t=1 s
    expect(await calls(2_000)).toBe(3); // t=3 s
    expect(await calls(4_000)).toBe(4); // t=7 s
    expect(await calls(8_000)).toBe(5); // t=15 s
    expect(await calls(8_000)).toBe(6); // t=23 s

    await vi.advanceTimersByTimeAsync(120_000);
    await pending;
  });

  it('stops after the 75 s budget and throws the last 503', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(problem503()));
    vi.stubGlobal('fetch', fetchMock);

    const pending = api.get('/api/health', schema).catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(75_000);

    const error = await pending;
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503 });
    const callsAtEnd = fetchMock.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBe(callsAtEnd);
    expect(getSnapshot()).toBe('idle');
  });

  it('retries a GET that receives 504', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 504 }))
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = api.get('/api/health', schema);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a POST that receives 504', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 504 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(request('POST', '/api/x', schema)).rejects.toMatchObject({ status: 504 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a POST that receives 503', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(problem503())
      .mockResolvedValueOnce(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    const pending = request('POST', '/api/x', schema);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ status: 'ok' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each([400, 500])('never retries a %i', async (status) => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/api/x', schema)).rejects.toMatchObject({ status });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('api with a JSON body', () => {
  it.each([
    ['post', 'POST'],
    ['patch', 'PATCH'],
    ['put', 'PUT'],
  ] as const)(
    '%s sends the method, a JSON content type and the serialized body',
    async (name, method) => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
      vi.stubGlobal('fetch', fetchMock);

      await api[name]('/api/x', schema, { a: 1 });

      const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
      expect(init.method).toBe(method);
      expect(init.body).toBe('{"a":1}');
      expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' });
    },
  );

  it('post without a body sends no body and no content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ status: 'ok' }));
    vi.stubGlobal('fetch', fetchMock);

    await api.post('/api/x', schema);

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBeUndefined();
    expect(init.headers).not.toHaveProperty('Content-Type');
  });

  it('does not retry the app own 503 STORAGE_UNAVAILABLE', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          type: 'about:blank',
          title: 'Unavailable',
          status: 503,
          code: ErrorCode.STORAGE_UNAVAILABLE,
        },
        503,
        'application/problem+json',
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.post('/api/x', schema, {})).rejects.toMatchObject({
      status: 503,
      code: ErrorCode.STORAGE_UNAVAILABLE,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
