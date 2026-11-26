import { type CanActivate, type ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { ErrorCode } from '@verso/shared';
import type { Request } from 'express';
import { loadAuthEnv } from '../../config/auth-env.js';
import { ApiException } from '../api-exception.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF protection for our own routes (ARCHITECTURE §10): a non-safe request under /api must come
 * from the web origin. A missing `Origin` is rejected too. /api/auth/* never reaches this guard
 * (it is middleware and Better Auth checks it), and routes outside /api are not affected.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = new URL(loadAuthEnv().WEB_ORIGIN).origin;

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    // Express matches routes ignoring case, so the prefix check must ignore it too.
    if (!req.path.toLowerCase().startsWith('/api/')) return true;
    if (req.headers.origin === this.allowed) return true;
    throw new ApiException(HttpStatus.FORBIDDEN, ErrorCode.ORIGIN_NOT_ALLOWED);
  }
}
