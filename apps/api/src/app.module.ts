import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { OriginGuard } from './common/origin/origin.guard.js';
import { ProblemJsonFilter } from './common/problem-json.filter.js';
import { serializeRequest } from './common/redact-request.js';
import { CatalogInfraModule } from './infra/catalog/catalog-infra.module.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { StorageModule } from './infra/storage/storage.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { CatalogModule } from './modules/catalog/catalog.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { LibraryModule } from './modules/library/library.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // JSON logs always (pino-pretty is not installed). Each request logs id, method, url, status and responseTime.
    // Cookies, tokens and credentials never reach the logs (Better Auth session cookie, auth headers).
    LoggerModule.forRoot({
      pinoHttp: {
        // Verification and reset tokens travel in the URL: log the path only (SPEC 08).
        serializers: { req: serializeRequest },
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
            // The password-reset redirect carries the token: /reset-password?token=...
            'res.headers.location',
          ],
          censor: '[Redacted]',
        },
      },
    }),
    PrismaModule,
    StorageModule,
    CatalogInfraModule,
    AuthModule,
    UsersModule,
    CatalogModule,
    LibraryModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: ProblemJsonFilter },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
