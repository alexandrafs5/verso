import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

/** Returns the user attached by SessionGuard. Use only on routes guarded by SessionGuard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    return context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  },
);
