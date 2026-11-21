import { describe, expect, it } from 'vitest';
import { messages } from './index';

function keys(obj: Record<string, unknown>, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null
      ? keys(v as Record<string, unknown>, `${prefix}${k}.`)
      : [`${prefix}${k}`],
  );
}

describe('message catalogs', () => {
  it('en and es have the same keys', () => {
    expect(keys(messages.es).sort()).toEqual(keys(messages.en).sort());
  });
});
