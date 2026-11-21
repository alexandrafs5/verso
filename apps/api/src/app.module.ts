import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { HealthModule } from './modules/health/health.module.js';

@Module({
  imports: [
    // JSON logs always (pino-pretty is not installed). Each request logs id, method, url, status and responseTime.
    LoggerModule.forRoot(),
    HealthModule,
  ],
})
export class AppModule {}
