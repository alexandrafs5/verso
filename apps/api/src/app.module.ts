import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ProblemJsonFilter } from './common/problem-json.filter.js';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    // JSON logs always (pino-pretty is not installed). Each request logs id, method, url, status and responseTime.
    LoggerModule.forRoot(),
    HealthModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ProblemJsonFilter }],
})
export class AppModule {}
