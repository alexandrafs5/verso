import type { Me } from '@verso/shared';

export const TOTAL_STEPS = 7;

/** Keys of the `onboarding.steps` copy, in step order (DESIGN P3). */
export const STEP_KEYS = [
  'name',
  'photo',
  'rating',
  'progress',
  'privacy',
  'goal',
  'import',
] as const;
export type StepKey = (typeof STEP_KEYS)[number];

/** Photo, yearly goal and Goodreads import can be skipped. */
export const OPTIONAL_STEPS: readonly number[] = [2, 6, 7];

export const stepPath = (step: number): string => `/onboarding/${step}`;

export const isOptionalStep = (step: number): boolean => OPTIONAL_STEPS.includes(step);

/** Parses the `[step]` route segment: 1 to 7, else null. */
export function parseStep(raw: string): number | null {
  if (!/^[1-7]$/.test(raw)) return null;
  return Number(raw);
}

/**
 * The step is derived, not stored: the username is the only required step, so a resume lands on
 * step 1 when it is missing and on step 2 otherwise. Later steps have defaults.
 */
export function firstIncompleteStep(me: Pick<Me, 'username'>): number {
  return me.username ? 2 : 1;
}
