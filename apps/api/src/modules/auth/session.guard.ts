import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from './auth.js';
import { AUTH } from './auth.constants.js';
import type { AuthenticatedRequest } from './auth.types.js';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & Partial<AuthenticatedRequest>>();
    const result = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!result) throw new UnauthorizedException('Authentication required');

    const { user, session } = result;
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image ?? null,
      emailVerified: user.emailVerified,
      role: user.role === 'ADMIN' ? 'ADMIN' : 'USER',
    };
    req.session = { id: session.id, expiresAt: session.expiresAt };
    return true;
  }
}
