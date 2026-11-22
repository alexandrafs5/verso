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
import type { AuthenticatedRequest, AuthUser } from './auth.types.js';

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
      username: user.username ?? null,
      bio: user.bio ?? null,
      // Enum values are enforced by the database; Better Auth types them as plain strings.
      profileVisibility: user.profileVisibility as AuthUser['profileVisibility'],
      defaultAnnotationVisibility:
        user.defaultAnnotationVisibility as AuthUser['defaultAnnotationVisibility'],
      ratingStyle: user.ratingStyle as AuthUser['ratingStyle'],
      progressStyle: user.progressStyle as AuthUser['progressStyle'],
      locale: user.locale as AuthUser['locale'],
      theme: user.theme as AuthUser['theme'],
      timeZone: user.timeZone as string,
      reminderEnabled: user.reminderEnabled as boolean,
      reminderTime: user.reminderTime ?? null,
      onboardingCompletedAt: user.onboardingCompletedAt ?? null,
    };
    req.session = { id: session.id, expiresAt: session.expiresAt };
    return true;
  }
}
