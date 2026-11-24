import { Controller, Get, Inject, Param, Query, UseGuards } from '@nestjs/common';
import {
  type AuthorDetail,
  type EditionDto,
  type EditionsQuery,
  editionsQuerySchema,
  type IsbnResult,
  type SearchBooksQuery,
  type SearchBooksResponse,
  searchBooksQuerySchema,
  type SeriesDetail,
  type WorkDetail,
} from '@verso/shared';
import { RateLimit, RateLimitBucket } from '../../common/rate-limit/rate-limit.js';
import { UserThrottlerGuard } from '../../common/rate-limit/user-throttler.guard.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, SessionGuard, type AuthUser } from '../auth/index.js';
import { CatalogService } from './catalog.service.js';

/**
 * HTTP and validation only. Refs, ISBNs and series ids are validated in the service,
 * so a bad one is 400 INVALID_REF / INVALID_ISBN rather than a generic validation error.
 */
@Controller('v1')
@UseGuards(SessionGuard, UserThrottlerGuard)
@RateLimit(RateLimitBucket.CATALOG_READ)
export class CatalogController {
  constructor(@Inject(CatalogService) private readonly catalog: CatalogService) {}

  @Get('search/books')
  @RateLimit(RateLimitBucket.SEARCH)
  searchBooks(
    @Query(new ZodValidationPipe(searchBooksQuerySchema)) query: SearchBooksQuery,
  ): Promise<SearchBooksResponse> {
    return this.catalog.searchBooks(query);
  }

  @Get('works/:ref')
  getWork(@CurrentUser() user: AuthUser, @Param('ref') ref: string): Promise<WorkDetail> {
    return this.catalog.getWork(user.id, ref);
  }

  @Get('works/:ref/editions')
  getEditions(
    @CurrentUser() user: AuthUser,
    @Param('ref') ref: string,
    @Query(new ZodValidationPipe(editionsQuerySchema)) query: EditionsQuery,
  ): Promise<EditionDto[]> {
    return this.catalog.getEditions(user.id, ref, query.language);
  }

  @Get('authors/:ref')
  getAuthor(@Param('ref') ref: string): Promise<AuthorDetail> {
    return this.catalog.getAuthor(ref);
  }

  @Get('series/:id')
  getSeries(@Param('id') id: string): Promise<SeriesDetail> {
    return this.catalog.getSeries(id);
  }

  @Get('isbn/:isbn')
  lookupIsbn(@Param('isbn') isbn: string): Promise<IsbnResult> {
    return this.catalog.lookupIsbn(isbn);
  }
}
