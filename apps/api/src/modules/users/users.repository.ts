import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import type { Prisma, User, YearlyGoal } from '../../generated/prisma/client.js';

export type ProfileUpdate = Pick<Prisma.UserUpdateInput, 'name' | 'username' | 'bio' | 'image'>;
export type SettingsUpdate = Pick<
  Prisma.UserUpdateInput,
  | 'ratingStyle'
  | 'progressStyle'
  | 'profileVisibility'
  | 'defaultAnnotationVisibility'
  | 'locale'
  | 'theme'
  | 'timeZone'
>;

/** Prisma only. Every method takes the session user id; nothing reads another user's row except the username lookup. */
@Injectable()
export class UsersRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Case-insensitive (the column is citext). Returns only the owner id. */
  findUsernameOwner(username: string): Promise<{ id: string } | null> {
    return this.prisma.user.findUnique({ where: { username }, select: { id: true } });
  }

  updateProfile(id: string, data: ProfileUpdate): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  updateSettings(id: string, data: SettingsUpdate): Promise<User> {
    return this.prisma.user.update({ where: { id }, data });
  }

  upsertGoal(userId: string, year: number, targetBooks: number): Promise<YearlyGoal> {
    return this.prisma.yearlyGoal.upsert({
      where: { userId_year: { userId, year } },
      create: { userId, year, targetBooks },
      update: { targetBooks },
    });
  }

  /** Sets the timestamp only when it is still null, so a second call keeps the first one. */
  async markOnboardingCompleted(id: string, at: Date): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id, onboardingCompletedAt: null },
      data: { onboardingCompletedAt: at },
    });
  }
}
