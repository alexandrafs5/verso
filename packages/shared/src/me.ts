import { z } from 'zod';
import { ratingStyleSchema } from './rating';

export const PROGRESS_STYLES = ['PAGES', 'PERCENT'] as const;
export const VISIBILITIES = ['PUBLIC', 'PRIVATE'] as const;
export const LOCALES = ['en', 'es'] as const;
export const THEMES = ['SYSTEM', 'LIGHT', 'DARK'] as const;

export const USERNAME_UNAVAILABLE_REASONS = [
  'TOO_SHORT',
  'TOO_LONG',
  'INVALID_CHARACTERS',
  'RESERVED',
  'TAKEN',
] as const;

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_CONTENT_TYPE = 'image/webp';

const timeZoneSchema = z.string().refine(isValidTimeZone, { message: 'Invalid time zone' });

/** "UTC" is the column default but engines omit it from supportedValuesOf. */
function isValidTimeZone(value: string): boolean {
  if (value === 'UTC') return true;
  return Intl.supportedValuesOf('timeZone').includes(value);
}

export const progressStyleSchema = z.enum(PROGRESS_STYLES);
export const visibilitySchema = z.enum(VISIBILITIES);
export const localeSchema = z.enum(LOCALES);
export const themeSchema = z.enum(THEMES);

export const settingsSchema = z.object({
  ratingStyle: ratingStyleSchema,
  progressStyle: progressStyleSchema,
  profileVisibility: visibilitySchema,
  defaultAnnotationVisibility: visibilitySchema,
  locale: localeSchema,
  theme: themeSchema,
  timeZone: z.string(),
});

export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  emailVerified: z.boolean(),
  name: z.string(),
  username: z.string().nullable(),
  bio: z.string().nullable(),
  image: z.string().nullable(),
  settings: settingsSchema,
  onboardingCompletedAt: z.string().nullable(),
});

export const updateMeSchema = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    username: z.string().optional(), // normalized and validated by UsernamePolicy
    bio: z.string().trim().max(300).nullable().optional(),
    avatarPath: z.string().min(1).max(256).optional(),
    removeAvatar: z.literal(true).optional(),
  })
  .refine((v) => !(v.avatarPath !== undefined && v.removeAvatar), {
    message: 'avatarPath and removeAvatar cannot be combined',
    path: ['removeAvatar'],
  });

/** Strict: reminder fields and unknown keys are rejected (reminders belong to P6). */
export const updateSettingsSchema = z.strictObject({
  ratingStyle: ratingStyleSchema.optional(),
  progressStyle: progressStyleSchema.optional(),
  profileVisibility: visibilitySchema.optional(),
  defaultAnnotationVisibility: visibilitySchema.optional(),
  locale: localeSchema.optional(),
  theme: themeSchema.optional(),
  timeZone: timeZoneSchema.optional(),
});

export const usernameAvailabilitySchema = z.object({
  available: z.boolean(),
  reason: z.enum(USERNAME_UNAVAILABLE_REASONS).optional(),
});

export const avatarUploadRequestSchema = z.object({
  contentType: z.literal(AVATAR_CONTENT_TYPE),
  size: z.number().int().positive().max(AVATAR_MAX_BYTES),
});

export const signedUploadSchema = z.object({
  path: z.string(),
  uploadUrl: z.string(),
  token: z.string(),
});

export const upsertGoalSchema = z.object({
  targetBooks: z.number().int().min(1).max(999),
});

export const goalSchema = z.object({
  year: z.number().int(),
  targetBooks: z.number().int(),
});

export type Me = z.infer<typeof meSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type UpdateMeInput = z.infer<typeof updateMeSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
export type UsernameAvailability = z.infer<typeof usernameAvailabilitySchema>;
export type AvatarUploadRequest = z.infer<typeof avatarUploadRequestSchema>;
export type SignedUpload = z.infer<typeof signedUploadSchema>;
export type UpsertGoalInput = z.infer<typeof upsertGoalSchema>;
export type Goal = z.infer<typeof goalSchema>;

/** Path param of `PUT /v1/me/goals/{year}`. The allowed range depends on the user's time zone and is checked by the API. */
export const goalYearParamSchema = z
  .string()
  .regex(/^\d{4}$/)
  .transform(Number);
