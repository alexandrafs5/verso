import { describe, expect, it } from 'vitest';
import {
  STEP_KEYS,
  TOTAL_STEPS,
  firstIncompleteStep,
  isOptionalStep,
  parseStep,
  stepPath,
} from './steps';

describe('parseStep', () => {
  it('accepts 1 to 7', () => {
    for (let n = 1; n <= TOTAL_STEPS; n++) expect(parseStep(String(n))).toBe(n);
  });

  it('rejects everything else', () => {
    for (const bad of ['0', '8', '01', '1.5', 'a', '', '-1', '10']) {
      expect(parseStep(bad)).toBeNull();
    }
  });
});

describe('firstIncompleteStep', () => {
  it('is step 1 without a username', () => {
    expect(firstIncompleteStep({ username: null })).toBe(1);
  });

  it('is step 2 once the username is set', () => {
    expect(firstIncompleteStep({ username: 'ana' })).toBe(2);
  });
});

describe('step metadata', () => {
  it('has one copy key per step', () => {
    expect(STEP_KEYS).toHaveLength(TOTAL_STEPS);
  });

  it('marks only steps 2, 6 and 7 as optional', () => {
    const optional = Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).filter(isOptionalStep);
    expect(optional).toEqual([2, 6, 7]);
  });

  it('builds the route path', () => {
    expect(stepPath(3)).toBe('/onboarding/3');
  });
});
