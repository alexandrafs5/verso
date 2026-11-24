import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';
import type { AuthenticatedRequest } from '../../modules/auth/auth.types.js';

/**
 * Counts requests per authenticated user. Must run after SessionGuard:
 * `@UseGuards(SessionGuard, UserThrottlerGuard)`.
 */
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as Partial<AuthenticatedRequest>).user;
    // Without a session SessionGuard has already rejected the request; the IP is only a fallback.
    return user ? `user:${user.id}` : String(req['ip'] ?? 'unknown');
  }

  /** The library only sets `Retry-After-<bucket>`; clients expect the plain header. */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    detail: ThrottlerLimitDetail,
  ): Promise<void> {
    context
      .switchToHttp()
      .getResponse<Response>()
      .setHeader('Retry-After', detail.timeToBlockExpire);
    return super.throwThrottlingException(context, detail);
  }
}
