import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import { toNodeHandler } from 'better-auth/node';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Auth } from './auth.js';
import { AUTH } from './auth.constants.js';

/** Forwards /api/auth/* to Better Auth. It reads the raw request body itself, so no body parser may run before it. */
@Injectable()
export class AuthHandlerMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(AUTH) auth: Auth) {
    this.handler = toNodeHandler(auth);
  }

  use(req: IncomingMessage, res: ServerResponse): void {
    void this.handler(req, res);
  }
}
