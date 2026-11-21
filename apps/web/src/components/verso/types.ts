// Local types for the Verso components. BookStatus moves to packages/shared in M4.1.
export type { CoverTone, RatingStyle } from '@verso/shared';

export type BookStatus = 'READING' | 'READ' | 'WANT_TO_READ' | 'ABANDONED';

// Menu order for status pickers.
export const BOOK_STATUS_ORDER: readonly BookStatus[] = [
  'WANT_TO_READ',
  'READING',
  'READ',
  'ABANDONED',
];

export type TagColor =
  'WINE' | 'TOBACCO' | 'BRASS' | 'FOREST' | 'NAVY' | 'OXBLOOD' | 'SLATE' | 'SAND';

export type Visibility = 'PUBLIC' | 'PRIVATE';
