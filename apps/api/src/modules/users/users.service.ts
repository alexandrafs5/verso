import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type {
  Goal,
  Me,
  UpdateMeInput,
  UpdateSettingsInput,
  UsernameAvailability,
} from '@verso/shared';
import { ApiException } from '../../common/api-exception.js';
import type { User } from '../../generated/prisma/client.js';
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
  constructor(@Inject(UsersRepository) private readonly users: UsersRepository) {}

  async getMe(userId: string): Promise<Me> {
    return toMe(await this.requireUser(userId));
  }

  async updateMe(userId: string, input: UpdateMeInput): Promise<Me> {
    const current = await this.requireUser(userId);
    const data: ProfileUpdate = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.bio !== undefined) data.bio = input.bio;

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
      return toMe(await this.users.updateProfile(userId, data));
    } catch (error) {
      // The unique index is the source of truth when two saves race.
      if (isUniqueViolation(error)) throw new ApiException(409, 'USERNAME_TAKEN');
      throw error;
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
      throw new BadRequestException('Goal year must be the current year or the next one');
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

  private async requireUser(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }
}
