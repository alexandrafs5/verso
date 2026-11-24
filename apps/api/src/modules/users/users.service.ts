import { ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import type {
  AvatarUploadRequest,
  Goal,
  Me,
  SignedUpload,
  UpdateMeInput,
  UpdateSettingsInput,
  UsernameAvailability,
} from '@verso/shared';
import { ApiException } from '../../common/api-exception.js';
import type { User } from '../../generated/prisma/client.js';
import { buildAvatarPath, isAvatarPathOwnedBy } from '../../infra/storage/avatar-path.js';
import { FILE_STORAGE, type FileStorage } from '../../infra/storage/file-storage.js';
import { GoalPolicy } from './domain/goal-policy.js';
import { UsernamePolicy } from './domain/username-policy.js';
import { UsersRepository } from './users.repository.js';
import { type ProfileUpdate } from './users.repository.js';

export function toMe(user: User): Me {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name: user.name,
    username: user.username,
    bio: user.bio,
    image: user.image,
    settings: {
      ratingStyle: user.ratingStyle,
      progressStyle: user.progressStyle,
      profileVisibility: user.profileVisibility,
      defaultAnnotationVisibility: user.defaultAnnotationVisibility,
      locale: user.locale,
      theme: user.theme,
      timeZone: user.timeZone,
    },
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
  };
}

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'P2002';

/** Every method acts on the session user id it is given and never takes a user id from the client. */
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async getMe(userId: string): Promise<Me> {
    return toMe(await this.requireUser(userId));
  }

  async updateMe(userId: string, input: UpdateMeInput): Promise<Me> {
    const current = await this.requireUser(userId);
    const data: ProfileUpdate = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.bio !== undefined) data.bio = input.bio;

    // The previous avatar object, deleted once the row points elsewhere.
    let staleImage: string | null = null;
    if (input.avatarPath !== undefined) {
      if (!isAvatarPathOwnedBy(userId, input.avatarPath)) {
        throw new ForbiddenException('Avatar path does not belong to the current user');
      }
      data.image = this.publicUrl(input.avatarPath);
      if (current.image !== data.image) staleImage = current.image;
    } else if (input.removeAvatar) {
      data.image = null;
      staleImage = current.image;
    }

    if (input.username !== undefined) {
      const result = UsernamePolicy.validate(input.username);
      if (!result.ok) throw new ApiException(400, 'USERNAME_INVALID', result.reason);
      if (result.username !== current.username?.toLowerCase()) {
        const owner = await this.users.findUsernameOwner(result.username);
        if (owner && owner.id !== userId) throw new ApiException(409, 'USERNAME_TAKEN');
      }
      data.username = result.username;
    }

    try {
      const updated = await this.users.updateProfile(userId, data);
      if (staleImage) await this.deleteStaleAvatar(userId, staleImage);
      return toMe(updated);
    } catch (error) {
      // The unique index is the source of truth when two saves race.
      if (isUniqueViolation(error)) throw new ApiException(409, 'USERNAME_TAKEN');
      throw error;
    }
  }

  async createAvatarUpload(userId: string, input: AvatarUploadRequest): Promise<SignedUpload> {
    await this.requireUser(userId);
    try {
      return await this.storage.createUploadUrl(buildAvatarPath(userId), input.contentType);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Avatar upload url failed');
      throw new ApiException(503, 'STORAGE_UNAVAILABLE');
    }
  }

  async updateSettings(userId: string, input: UpdateSettingsInput): Promise<Me> {
    await this.requireUser(userId);
    return toMe(await this.users.updateSettings(userId, input));
  }

  async checkUsername(userId: string, raw: string): Promise<UsernameAvailability> {
    const result = UsernamePolicy.validate(raw);
    if (!result.ok) return { available: false, reason: result.reason };
    const owner = await this.users.findUsernameOwner(result.username);
    if (owner && owner.id !== userId) return { available: false, reason: 'TAKEN' };
    return { available: true };
  }

  async upsertGoal(userId: string, year: number, targetBooks: number): Promise<Goal> {
    const user = await this.requireUser(userId);
    if (!GoalPolicy.isYearAllowed(year, user.timeZone)) {
      throw new ApiException(400, 'GOAL_YEAR_INVALID');
    }
    const goal = await this.users.upsertGoal(userId, year, targetBooks);
    return { year: goal.year, targetBooks: goal.targetBooks };
  }

  async completeOnboarding(userId: string): Promise<Me> {
    const user = await this.requireUser(userId);
    if (!user.username) throw new ApiException(409, 'USERNAME_REQUIRED');
    await this.users.markOnboardingCompleted(userId, new Date());
    return this.getMe(userId);
  }

  private publicUrl(path: string): string {
    try {
      return this.storage.publicUrl(path);
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : 'Storage public url failed');
      throw new ApiException(503, 'STORAGE_UNAVAILABLE');
    }
  }

  /** Best effort: a leftover object is harmless, so a storage failure never fails the save. Images not stored by us (e.g. Google) are skipped. */
  private async deleteStaleAvatar(userId: string, image: string): Promise<void> {
    try {
      const prefix = this.storage.publicUrl('');
      if (!image.startsWith(prefix)) return;
      const path = decodeURIComponent(image.slice(prefix.length));
      if (!isAvatarPathOwnedBy(userId, path)) return;
      await this.storage.delete(path);
    } catch (error) {
      this.logger.warn(error instanceof Error ? error.message : 'Avatar delete failed');
    }
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
