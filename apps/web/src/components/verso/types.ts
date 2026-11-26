import type { BookStatus } from '@verso/shared';

// Local types for the Verso components. Domain types come from packages/shared.
export type { BookStatus, CoverTone, RatingStyle, TagColor } from '@verso/shared';

// Menu order for status pickers.
export const BOOK_STATUS_ORDER: readonly BookStatus[] = [
  'WANT_TO_READ',
  'READING',
  'READ',
  'ABANDONED',
];

export type Visibility = 'PUBLIC' | 'PRIVATE';
