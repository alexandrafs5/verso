import { readFileSync } from 'node:fs';

/** Loads a recorded Open Library response from `fixtures/`. Test helper only. */
export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8')) as T;
}
