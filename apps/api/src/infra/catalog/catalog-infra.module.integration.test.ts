import 'reflect-metadata';
import { Inject, Injectable, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { afterEach, describe, expect, it } from 'vitest';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogInfraModule, createCatalogProvider } from './catalog-infra.module.js';
import { CATALOG_PROVIDER, type CatalogProvider } from './catalog-provider.js';
import { EXTERNAL_CACHE_STORE } from './external-cache.js';
import { ExternalCacheRepository } from './external-cache.repository.js';
import { InMemoryCatalogProvider } from './in-memory-catalog.provider.js';
import { InMemoryExternalCache } from './in-memory-external-cache.js';
import { OpenLibraryProvider } from './open-library.provider.js';

@Injectable()
class Consumer {
  constructor(@Inject(CATALOG_PROVIDER) readonly catalog: CatalogProvider) {}
}

@Module({ imports: [PrismaModule, CatalogInfraModule], providers: [Consumer] })
class RealCatalogModule {}

// No @nestjs/testing in this repo: a test module provides the fake under the same token.
const fake = new InMemoryCatalogProvider();

@Module({
  providers: [{ provide: CATALOG_PROVIDER, useValue: fake }, Consumer],
})
class FakeCatalogModule {}

describe('CatalogInfraModule', () => {
  const originalNodeEnv = process.env['NODE_ENV'];
  const originalContact = process.env['OPEN_LIBRARY_CONTACT'];

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env['NODE_ENV'];
    else process.env['NODE_ENV'] = originalNodeEnv;
    if (originalContact === undefined) delete process.env['OPEN_LIBRARY_CONTACT'];
    else process.env['OPEN_LIBRARY_CONTACT'] = originalContact;
  });

  it('provides the Open Library provider and the Postgres cache by default', async () => {
    delete process.env['OPEN_LIBRARY_CONTACT'];
    const ctx = await NestFactory.createApplicationContext(RealCatalogModule, { logger: false });
    expect(ctx.get(Consumer).catalog).toBeInstanceOf(OpenLibraryProvider);
    expect(ctx.get(EXTERNAL_CACHE_STORE, { strict: false })).toBeInstanceOf(
      ExternalCacheRepository,
    );
    await ctx.close();
  });

  it('lets a test module swap CATALOG_PROVIDER for the in-memory fake', async () => {
    const ctx = await NestFactory.createApplicationContext(FakeCatalogModule, { logger: false });
    expect(ctx.get(Consumer).catalog).toBe(fake);
    await ctx.close();
  });

  it('fails to boot in production without OPEN_LIBRARY_CONTACT', async () => {
    process.env['NODE_ENV'] = 'production';
    delete process.env['OPEN_LIBRARY_CONTACT'];
    await expect(
      NestFactory.createApplicationContext(RealCatalogModule, {
        logger: false,
        abortOnError: false,
      }),
    ).rejects.toThrow(/OPEN_LIBRARY_CONTACT/);
  });

  it('createCatalogProvider builds an OpenLibraryProvider', () => {
    expect(
      createCatalogProvider({ OPEN_LIBRARY_CONTACT: 'a@b.c' }, new InMemoryExternalCache()),
    ).toBeInstanceOf(OpenLibraryProvider);
  });
});
