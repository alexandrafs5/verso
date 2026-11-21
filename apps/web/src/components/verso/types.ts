// Local types for the Verso components. BookStatus moves to packages/shared in M4.1;
// CoverTone and RatingStyle are replaced by shared imports in M1.4.
export type BookStatus = 'READING' | 'READ' | 'WANT_TO_READ' | 'ABANDONED';

// Menu order for status pickers.
export const BOOK_STATUS_ORDER: readonly BookStatus[] = [
  'WANT_TO_READ',
  'READING',
  'READ',
  'ABANDONED',
];

export type CoverTone = 'wine' | 'tobacco' | 'forest' | 'navy' | 'oxblood' | 'slate';

export type RatingStyle = 'STARS_WHOLE' | 'STARS_HALF' | 'STARS_QUARTER' | 'DECIMAL_10' | 'HUNDRED';

export type TagColor =
  'WINE' | 'TOBACCO' | 'BRASS' | 'FOREST' | 'NAVY' | 'OXBLOOD' | 'SLATE' | 'SAND';

export type Visibility = 'PUBLIC' | 'PRIVATE';
