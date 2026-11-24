import { Global, Module } from '@nestjs/common';
import { type CatalogEnv, loadCatalogEnv } from './catalog-env.js';
import { CATALOG_PROVIDER, type CatalogProvider } from './catalog-provider.js';
import { EXTERNAL_CACHE_STORE, type ExternalCacheStore } from './external-cache.js';
import { ExternalCacheRepository } from './external-cache.repository.js';
import { OpenLibraryProvider } from './open-library.provider.js';

export function createCatalogProvider(env: CatalogEnv, cache: ExternalCacheStore): CatalogProvider {
  return new OpenLibraryProvider({ contact: env.OPEN_LIBRARY_CONTACT, cache });
}

/**
 * Exposes CATALOG_PROVIDER (Open Library) and EXTERNAL_CACHE_STORE (Postgres).
 * Tests provide InMemoryCatalogProvider under the same CATALOG_PROVIDER token.
 */
@Global()
@Module({
  providers: [
    ExternalCacheRepository,
    { provide: EXTERNAL_CACHE_STORE, useExisting: ExternalCacheRepository },
    {
      provide: CATALOG_PROVIDER,
      useFactory: (cache: ExternalCacheStore) => createCatalogProvider(loadCatalogEnv(), cache),
      inject: [EXTERNAL_CACHE_STORE],
    },
  ],
  exports: [CATALOG_PROVIDER, EXTERNAL_CACHE_STORE],
})
export class CatalogInfraModule {}
