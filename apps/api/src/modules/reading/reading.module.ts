import { Module } from '@nestjs/common';
import { ReadingRepository } from './reading.repository.js';
import { ReadingService } from './reading.service.js';

// Imports no feature module (SPEC 20): library depends on reading, never the other way around.
@Module({
  providers: [ReadingService, ReadingRepository],
  exports: [ReadingService],
})
export class ReadingModule {}
