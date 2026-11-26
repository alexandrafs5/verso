import { Body, Controller, Inject, Post, UseGuards } from '@nestjs/common';
import {
  type AddToLibraryBody,
  addToLibraryBodySchema,
  type AddToLibraryResponse,
} from '@verso/shared';
import { UserThrottlerGuard } from '../../common/rate-limit/user-throttler.guard.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, SessionGuard, type AuthUser } from '../auth/index.js';
import { LibraryService } from './library.service.js';

/** HTTP and validation only. Writes count against the `writes` rate limit bucket. */
@Controller('v1/library')
@UseGuards(SessionGuard, UserThrottlerGuard)
export class LibraryController {
  constructor(@Inject(LibraryService) private readonly library: LibraryService) {}

  @Post()
  add(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(addToLibraryBodySchema)) body: AddToLibraryBody,
  ): Promise<AddToLibraryResponse> {
    return this.library.add(user, body);
  }
}
