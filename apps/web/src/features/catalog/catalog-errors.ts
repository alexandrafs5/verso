import { ApiError } from '@/lib/api-client';

/** A missing catalog entry, or a ref or id that cannot exist (SPEC 18: both show not-found). */
export function isCatalogNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.code === 'CATALOG_NOT_FOUND' || error.code === 'INVALID_REF')
  );
}

export function isRateLimited(error: unknown): boolean {
  return error instanceof ApiError && error.status === 429;
}
