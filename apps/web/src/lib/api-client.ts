import { type ErrorCode, type Problem, problemSchema } from '@verso/shared';
import type { z } from 'zod';
import { markWaking } from './waking-state';

export type { WakingState } from './waking-state';

export class ApiError extends Error {
  status: number;
  /** null when the body is not valid problem+json */
  code: ErrorCode | null;
  problem: Problem | null;

  constructor(
    message: string,
    options: { status: number; problem?: Problem | null; cause?: unknown },
  ) {
    super(message, { cause: options.cause });
    this.name = 'ApiError';
    this.status = options.status;
    this.problem = options.problem ?? null;
    this.code = this.problem?.code ?? null;
  }
}

export interface RequestOptions {
  signal?: AbortSignal;
}

export const WAKING_THRESHOLD_MS = 3_000;
export const RETRY_BUDGET_MS = 75_000;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000];

function backoffDelay(retryIndex: number): number {
  return BACKOFF_MS[Math.min(retryIndex, BACKOFF_MS.length - 1)] as number;
}

function isRetryable(method: string, error: ApiError): boolean {
  if (method === 'GET') return [0, 502, 503, 504].includes(error.status);
  // Non-GET: only when the request surely never reached the app.
  return error.status === 502 || error.status === 503;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function attempt<T>(
  method: string,
  path: string,
  schema: z.ZodType<T>,
  opts: RequestOptions,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: { Accept: 'application/json, application/problem+json' },
      signal: opts.signal,
    });
  } catch (cause) {
    if (opts.signal?.aborted) throw cause;
    throw new ApiError('Network error', { status: 0, cause });
  }

  const body = await readJson(response);

  if (!response.ok) {
    const parsed = problemSchema.safeParse(body);
    throw new ApiError(parsed.success ? parsed.data.title : `HTTP ${response.status}`, {
      status: response.status,
      problem: parsed.success ? parsed.data : null,
    });
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError('Response does not match the expected schema', {
      status: response.status,
      cause: result.error,
    });
  }
  return result.data;
}

/** @internal Exported for tests; use `api` in app code. */
export async function request<T>(
  method: string,
  path: string,
  schema: z.ZodType<T>,
  opts: RequestOptions = {},
): Promise<T> {
  const startedAt = Date.now();
  let release: (() => void) | null = null;
  const wake = () => {
    release ??= markWaking();
  };
  const wakingTimer = setTimeout(wake, WAKING_THRESHOLD_MS);

  try {
    for (let retryIndex = 0; ; retryIndex++) {
      try {
        return await attempt(method, path, schema, opts);
      } catch (error) {
        if (!(error instanceof ApiError) || !isRetryable(method, error)) throw error;
        const delay = backoffDelay(retryIndex);
        if (Date.now() - startedAt + delay > RETRY_BUDGET_MS) throw error;
        wake();
        await sleep(delay, opts.signal);
      }
    }
  } finally {
    clearTimeout(wakingTimer);
    (release as (() => void) | null)?.();
  }
}

export const api = {
  get<T>(path: string, schema: z.ZodType<T>, opts?: RequestOptions): Promise<T> {
    return request('GET', path, schema, opts);
  },
};
