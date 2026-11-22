import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ProblemJsonFilter } from './common/problem-json.filter.js';
import { PrismaModule } from './infra/prisma/prisma.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    // JSON logs always (pino-pretty is not installed). Each request logs id, method, url, status and responseTime.
    // Cookies, tokens and credentials never reach the logs (Better Auth session cookie, auth headers).
    LoggerModule.forRoot({
      pinoHttp: {
        redact: {
          paths: ['req.headers.cookie', 'req.headers.authorization', 'res.headers["set-cookie"]'],
          censor: '[Redacted]',
        },
      },
    }),
    PrismaModule,
    AuthModule,
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemJsonFilter }],
})
export class AppModule {}
