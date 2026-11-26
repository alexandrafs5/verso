import { Module } from '@nestjs/common';
import { RateLimitModule } from '../../common/rate-limit/rate-limit.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { LibraryStatusModule } from '../library/library-status.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogRepository } from './catalog.repository.js';
import { CatalogService } from './catalog.service.js';

// CatalogInfraModule is global, so CATALOG_PROVIDER needs no import here.
@Module({
  imports: [AuthModule, RateLimitModule, LibraryStatusModule],
  controllers: [CatalogController],
  providers: [CatalogService, CatalogRepository],
  exports: [CatalogService],
})
export class CatalogModule {}
