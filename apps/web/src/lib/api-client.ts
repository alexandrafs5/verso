import { type ErrorCode, type Problem, problemSchema } from '@verso/shared';
import type { z } from 'zod';

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

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

async function request<T>(
  method: string,
  path: string,
  schema: z.ZodType<T>,
  opts: RequestOptions = {},
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

export const api = {
  get<T>(path: string, schema: z.ZodType<T>, opts?: RequestOptions): Promise<T> {
    return request('GET', path, schema, opts);
  },
};
