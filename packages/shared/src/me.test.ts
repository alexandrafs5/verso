import { describe, expect, it } from 'vitest';
import {
  avatarUploadRequestSchema,
  goalYearParamSchema,
  updateMeSchema,
  updateSettingsSchema,
  usernameParamSchema,
  upsertGoalSchema,
} from './me.js';

describe('updateMeSchema', () => {
  it('trims the name and accepts partial input', () => {
    expect(updateMeSchema.parse({ name: '  Ana ' }).name).toBe('Ana');
    expect(updateMeSchema.safeParse({}).success).toBe(true);
  });

  it('rejects an empty name and a bio over 300 characters', () => {
    expect(updateMeSchema.safeParse({ name: '   ' }).success).toBe(false);
    expect(updateMeSchema.safeParse({ bio: 'a'.repeat(301) }).success).toBe(false);
  });

  it('accepts a null bio and removeAvatar only as true', () => {
    expect(updateMeSchema.safeParse({ bio: null }).success).toBe(true);
    expect(updateMeSchema.safeParse({ removeAvatar: true }).success).toBe(true);
    expect(updateMeSchema.safeParse({ removeAvatar: false }).success).toBe(false);
  });

  it('rejects avatarPath together with removeAvatar', () => {
    const r = updateMeSchema.safeParse({ avatarPath: 'avatars/u1/x.webp', removeAvatar: true });
    expect(r.success).toBe(false);
  });

  it('accepts an avatarPath string', () => {
    expect(updateMeSchema.safeParse({ avatarPath: 'avatars/u1/x.webp' }).success).toBe(true);
  });
});

describe('updateSettingsSchema', () => {
  it('accepts valid enum values and time zones', () => {
    const r = updateSettingsSchema.safeParse({
      ratingStyle: 'HUNDRED',
      progressStyle: 'PERCENT',
      profileVisibility: 'PRIVATE',
      defaultAnnotationVisibility: 'PUBLIC',
      locale: 'es',
      theme: 'DARK',
      timeZone: 'Europe/Madrid',
    });
    expect(r.success).toBe(true);
  });

  it('accepts UTC', () => {
    expect(updateSettingsSchema.safeParse({ timeZone: 'UTC' }).success).toBe(true);
  });

  it('rejects invalid enum values', () => {
    expect(updateSettingsSchema.safeParse({ ratingStyle: 'STARS_TEN' }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ locale: 'fr' }).success).toBe(false);
  });

  it('rejects an invalid time zone', () => {
    expect(updateSettingsSchema.safeParse({ timeZone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('rejects reminder fields and unknown keys', () => {
    expect(updateSettingsSchema.safeParse({ reminderEnabled: true }).success).toBe(false);
    expect(updateSettingsSchema.safeParse({ reminderTime: '20:00' }).success).toBe(false);
  });
});

describe('avatarUploadRequestSchema', () => {
  it('accepts image/webp up to 2 MB', () => {
    expect(
      avatarUploadRequestSchema.safeParse({ contentType: 'image/webp', size: 2 * 1024 * 1024 })
        .success,
    ).toBe(true);
  });

  it('rejects other content types, oversize, zero and non-integer sizes', () => {
    expect(
      avatarUploadRequestSchema.safeParse({ contentType: 'image/png', size: 10 }).success,
    ).toBe(false);
    expect(
      avatarUploadRequestSchema.safeParse({ contentType: 'image/webp', size: 2 * 1024 * 1024 + 1 })
        .success,
    ).toBe(false);
    expect(
      avatarUploadRequestSchema.safeParse({ contentType: 'image/webp', size: 0 }).success,
    ).toBe(false);
    expect(
      avatarUploadRequestSchema.safeParse({ contentType: 'image/webp', size: 1.5 }).success,
    ).toBe(false);
  });
});

describe('upsertGoalSchema', () => {
  it('accepts 1 to 999 integers', () => {
    expect(upsertGoalSchema.safeParse({ targetBooks: 1 }).success).toBe(true);
    expect(upsertGoalSchema.safeParse({ targetBooks: 999 }).success).toBe(true);
  });

  it('rejects 0, 1000 and non-integers', () => {
    expect(upsertGoalSchema.safeParse({ targetBooks: 0 }).success).toBe(false);
    expect(upsertGoalSchema.safeParse({ targetBooks: 1000 }).success).toBe(false);
    expect(upsertGoalSchema.safeParse({ targetBooks: 12.5 }).success).toBe(false);
  });
});

describe('goalYearParamSchema', () => {
  it('parses a four-digit year to a number', () => {
    expect(goalYearParamSchema.parse('2026')).toBe(2026);
  });

  it('rejects anything else', () => {
    for (const bad of ['26', '20266', 'abc', '2026.5', '-2026', '']) {
      expect(goalYearParamSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('usernameParamSchema', () => {
  it('accepts any non-empty string up to 255 characters, so the policy can report the reason', () => {
    expect(usernameParamSchema.safeParse('a').success).toBe(true);
    expect(usernameParamSchema.safeParse('x'.repeat(255)).success).toBe(true);
  });

  it('rejects an empty or absurdly long value', () => {
    expect(usernameParamSchema.safeParse('').success).toBe(false);
    expect(usernameParamSchema.safeParse('x'.repeat(256)).success).toBe(false);
  });
});
