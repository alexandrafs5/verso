import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { problemSchema } from '@verso/shared';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ProblemJsonFilter } from './problem-json.filter.js';

function run(exception: unknown) {
  const json = vi.fn();
  const type = vi.fn<(contentType: string) => { json: typeof json }>(() => ({ json }));
  const status = vi.fn<(code: number) => { type: typeof type }>(() => ({ type }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  const filter = new ProblemJsonFilter();
  vi.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

  filter.catch(exception, host);

  return {
    status: status.mock.calls[0]?.[0] as number,
    contentType: type.mock.calls[0]?.[0] as string,
    body: json.mock.calls[0]?.[0] as unknown,
    logged: vi.mocked(filter['logger'].error),
  };
}

describe('ProblemJsonFilter', () => {
  it('maps NotFoundException to 404 NOT_FOUND', () => {
    const res = run(new NotFoundException('Cannot GET /x'));
    expect(res.status).toBe(404);
    expect(res.contentType).toBe('application/problem+json');
    const problem = problemSchema.parse(res.body);
    expect(problem).toMatchObject({
      code: 'NOT_FOUND',
      title: 'Not Found',
      detail: 'Cannot GET /x',
    });
  });

  it('maps ZodError to 400 VALIDATION_ERROR with errors[]', () => {
    const parsed = z
      .object({ user: z.object({ email: z.email() }) })
      .safeParse({ user: { email: 'x' } });
    expect(parsed.success).toBe(false);
    const res = run(parsed.error);
    expect(res.status).toBe(400);
    const problem = problemSchema.parse(res.body);
    expect(problem.code).toBe('VALIDATION_ERROR');
    expect(problem.errors).toEqual([{ path: 'user.email', message: expect.any(String) }]);
  });

  it('maps a plain 400 HttpException to VALIDATION_ERROR without errors[]', () => {
    const res = run(new BadRequestException('Malformed JSON'));
    const problem = problemSchema.parse(res.body);
    expect(res.status).toBe(400);
    expect(problem.code).toBe('VALIDATION_ERROR');
    expect(problem.errors).toBeUndefined();
  });

  it('maps 401 to UNAUTHENTICATED and 403 to FORBIDDEN', () => {
    const unauthorized = run(new UnauthorizedException());
    expect(unauthorized.status).toBe(401);
    expect(problemSchema.parse(unauthorized.body).code).toBe('UNAUTHENTICATED');
    const forbidden = run(new ForbiddenException());
    expect(forbidden.status).toBe(403);
    expect(problemSchema.parse(forbidden.body).code).toBe('FORBIDDEN');
  });

  it('maps other 4xx HttpExceptions to INTERNAL_ERROR keeping the status', () => {
    const res = run(new ConflictException());
    const problem = problemSchema.parse(res.body);
    expect(res.status).toBe(409);
    expect(problem.code).toBe('INTERNAL_ERROR');
  });

  it('hides message and stack for 5xx HttpException and logs it', () => {
    const res = run(new InternalServerErrorException('db password is hunter2'));
    const problem = problemSchema.parse(res.body);
    expect(res.status).toBe(500);
    expect(problem.code).toBe('INTERNAL_ERROR');
    expect(problem.detail).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('hunter2');
    expect(res.logged).toHaveBeenCalled();
  });

  it('maps unknown errors to a generic 500 with no leak and logs the stack', () => {
    const error = new Error('secret internal failure');
    const res = run(error);
    const problem = problemSchema.parse(res.body);
    expect(res.status).toBe(500);
    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
    expect(JSON.stringify(res.body)).not.toContain('secret');
    expect(res.logged).toHaveBeenCalledWith('secret internal failure', error.stack);
  });

  it('handles non-Error throwables', () => {
    const res = run('boom');
    expect(res.status).toBe(500);
    expect(problemSchema.parse(res.body).code).toBe('INTERNAL_ERROR');
  });
});
