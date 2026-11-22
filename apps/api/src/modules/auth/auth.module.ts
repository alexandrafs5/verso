import { type MiddlewareConsumer, Module, type NestModule, RequestMethod } from '@nestjs/common';
import { loadAuthEnv } from '../../config/auth-env.js';
import { EmailModule } from '../../infra/email/email.module.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuthEmailService } from './auth-email.service.js';
import { AuthHandlerMiddleware } from './auth-handler.middleware.js';
import { createAuth } from './auth.js';
import { AUTH } from './auth.constants.js';
import { AdminGuard } from './admin.guard.js';
import { SessionGuard } from './session.guard.js';

@Module({
  imports: [EmailModule],
  providers: [
    {
      provide: AUTH,
      inject: [PrismaService, AuthEmailService],
      // loadAuthEnv throws when BETTER_AUTH_SECRET is missing, which fails the boot.
      useFactory: (prisma: PrismaService, authEmail: AuthEmailService) =>
        createAuth(prisma, loadAuthEnv(), authEmail),
    },
    AuthEmailService,
    AuthHandlerMiddleware,
    SessionGuard,
    AdminGuard,
  ],
  exports: [AUTH, SessionGuard, AdminGuard],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(AuthHandlerMiddleware)
      .forRoutes({ path: 'auth/*splat', method: RequestMethod.ALL });
  }
}
