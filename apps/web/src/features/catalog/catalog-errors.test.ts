import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { isCatalogNotFound, isRateLimited } from './catalog-errors';

const problem = (status: number, code: string) =>
  new ApiError('x', {
    status,
    problem: { type: 'about:blank', title: 'x', status, code } as never,
  });

describe('catalog errors', () => {
  it('treats 404 and an invalid ref as not found', () => {
    expect(isCatalogNotFound(problem(404, 'CATALOG_NOT_FOUND'))).toBe(true);
    expect(isCatalogNotFound(problem(400, 'INVALID_REF'))).toBe(true);
    expect(isCatalogNotFound(new ApiError('x', { status: 404 }))).toBe(true);
  });

  it('does not treat other failures as not found', () => {
    expect(isCatalogNotFound(problem(503, 'CATALOG_UNAVAILABLE'))).toBe(false);
    expect(isCatalogNotFound(problem(400, 'VALIDATION_ERROR'))).toBe(false);
    expect(isCatalogNotFound(new Error('boom'))).toBe(false);
  });

  it('detects a 429', () => {
    expect(isRateLimited(problem(429, 'RATE_LIMITED'))).toBe(true);
    expect(isRateLimited(problem(503, 'CATALOG_UNAVAILABLE'))).toBe(false);
  });
});
