import { Module } from '@nestjs/common';
import { CatalogRepository } from './catalog.repository.js';

// CatalogInfraModule is global (CATALOG_PROVIDER). Service, controller and
// auth/rate-limit imports are added in the next steps.
@Module({
  providers: [CatalogRepository],
  exports: [CatalogRepository],
})
export class CatalogModule {}
