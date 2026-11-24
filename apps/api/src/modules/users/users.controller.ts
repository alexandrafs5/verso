import {
  Body,
  Controller,
  Get,
  Inject,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  type AvatarUploadRequest,
  avatarUploadRequestSchema,
  goalYearParamSchema,
  type Goal,
  type Me,
  type SignedUpload,
  type UpdateMeInput,
  type UpdateSettingsInput,
  type UpsertGoalInput,
  type UsernameAvailability,
  updateMeSchema,
  updateSettingsSchema,
  upsertGoalSchema,
  usernameParamSchema,
} from '@verso/shared';
import { RateLimit, RateLimitBucket } from '../../common/rate-limit/rate-limit.js';
import { UserThrottlerGuard } from '../../common/rate-limit/user-throttler.guard.js';
import { ZodValidationPipe } from '../../common/zod-validation.pipe.js';
import { CurrentUser, SessionGuard, type AuthUser } from '../auth/index.js';
import { UsersService } from './users.service.js';

/** HTTP and validation only. Every route acts on the session user. */
@Controller('v1')
@UseGuards(SessionGuard, UserThrottlerGuard)
export class UsersController {
  constructor(@Inject(UsersService) private readonly users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateMeSchema)) body: UpdateMeInput,
  ): Promise<Me> {
    return this.users.updateMe(user.id, body);
  }

  @Patch('me/settings')
  updateSettings(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateSettingsSchema)) body: UpdateSettingsInput,
  ): Promise<Me> {
    return this.users.updateSettings(user.id, body);
  }

  @Post('me/avatar/upload-url')
  @RateLimit(RateLimitBucket.AVATAR_UPLOAD)
  @HttpCode(200)
  createAvatarUpload(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(avatarUploadRequestSchema)) body: AvatarUploadRequest,
  ): Promise<SignedUpload> {
    return this.users.createAvatarUpload(user.id, body);
  }

  @Get('usernames/:username/availability')
  @RateLimit(RateLimitBucket.USERNAME_CHECK)
  checkUsername(
    @CurrentUser() user: AuthUser,
    @Param('username', new ZodValidationPipe(usernameParamSchema)) username: string,
  ): Promise<UsernameAvailability> {
    return this.users.checkUsername(user.id, username);
  }

  @Put('me/goals/:year')
  upsertGoal(
    @CurrentUser() user: AuthUser,
    @Param('year', new ZodValidationPipe(goalYearParamSchema)) year: number,
    @Body(new ZodValidationPipe(upsertGoalSchema)) body: UpsertGoalInput,
  ): Promise<Goal> {
    return this.users.upsertGoal(user.id, year, body.targetBooks);
  }

  @Post('me/onboarding/complete')
  @HttpCode(200)
  completeOnboarding(@CurrentUser() user: AuthUser): Promise<Me> {
    return this.users.completeOnboarding(user.id);
  }
}
