import { SetMetadata } from '@nestjs/common';
import type { ThrottlerOptions } from '@nestjs/throttler';

const WINDOW_MS = 60_000;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Buckets that a route can opt into. Routes without a bucket fall in `writes` when they mutate. */
export const RateLimitBucket = {
  WRITES: 'writes',
  SEARCH: 'search',
  CATALOG_READ: 'catalogRead',
  USERNAME_CHECK: 'usernameCheck',
  AVATAR_UPLOAD: 'avatarUpload',
} as const;
export type RateLimitBucket = (typeof RateLimitBucket)[keyof typeof RateLimitBucket];

/** Requests per minute per user (ARCHITECTURE §10). */
export const RATE_LIMITS: Record<RateLimitBucket, number> = {
  writes: 120,
  search: 60,
  catalogRead: 120,
  usernameCheck: 30,
  avatarUpload: 10,
};

export const RATE_LIMIT_BUCKET_KEY = 'verso:rate-limit-bucket';

/** Puts the route in a named bucket; it then no longer counts against the generic `writes` bucket. */
export const RateLimit = (bucket: RateLimitBucket): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_BUCKET_KEY, bucket);

/** Handler metadata wins over controller metadata. */
function bucketOf(handler: object, controller: object): string | undefined {
  return (
    (Reflect.getMetadata(RATE_LIMIT_BUCKET_KEY, handler) as string | undefined) ??
    (Reflect.getMetadata(RATE_LIMIT_BUCKET_KEY, controller) as string | undefined)
  );
}

/** One throttler per bucket; each skips every route that is not in it. */
export function buildThrottlers(): ThrottlerOptions[] {
  return (Object.keys(RATE_LIMITS) as RateLimitBucket[]).map((bucket) => ({
    name: bucket,
    ttl: WINDOW_MS,
    limit: RATE_LIMITS[bucket],
    skipIf: (context) => {
      const req = context.switchToHttp().getRequest<{ method: string }>();
      const declared = bucketOf(context.getHandler(), context.getClass());
      if (bucket === RateLimitBucket.WRITES) {
        return declared !== undefined || SAFE_METHODS.has(req.method);
      }
      return declared !== bucket;
    },
  }));
}
