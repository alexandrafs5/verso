import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { buildThrottlers } from './rate-limit.js';
import { UserThrottlerGuard } from './user-throttler.guard.js';

@Module({
  imports: [ThrottlerModule.forRoot({ throttlers: buildThrottlers() })],
  providers: [UserThrottlerGuard],
  exports: [ThrottlerModule, UserThrottlerGuard],
})
export class RateLimitModule {}
