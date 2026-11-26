import { z } from 'zod';

export const BOOK_STATUSES = ['READING', 'READ', 'WANT_TO_READ', 'ABANDONED'] as const;

export const TAG_COLORS = [
  'WINE',
  'TOBACCO',
  'BRASS',
  'FOREST',
  'NAVY',
  'OXBLOOD',
  'SLATE',
  'SAND',
] as const;

export const bookStatusSchema = z.enum(BOOK_STATUSES);
export const tagColorSchema = z.enum(TAG_COLORS);

export type BookStatus = z.infer<typeof bookStatusSchema>;
export type TagColor = z.infer<typeof tagColorSchema>;
