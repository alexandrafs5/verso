import { Module } from '@nestjs/common';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogModule } from '../catalog/catalog.module.js';
import { ReadingModule } from '../reading/reading.module.js';
import { LibraryController } from './library.controller.js';
import { LibraryRepository } from './library.repository.js';
import { LibraryService } from './library.service.js';

@Module({
  imports: [AuthModule, RateLimitModule, CatalogModule, ReadingModule],
  controllers: [LibraryController],
  providers: [LibraryService, LibraryRepository],
  exports: [LibraryService],
})
export class LibraryModule {}
