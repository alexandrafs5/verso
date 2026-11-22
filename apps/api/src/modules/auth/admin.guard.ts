import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { AuthenticatedRequest } from './auth.types.js';

/** Must run after SessionGuard: `@UseGuards(SessionGuard, AdminGuard)`. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Partial<AuthenticatedRequest>>();
    if (req.user?.role !== 'ADMIN') throw new ForbiddenException('Admin access required');
    return true;
  }
}
