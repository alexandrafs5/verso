import { describe, expect, it } from 'vitest';
import { usernameCandidates } from './suggest-username';

describe('usernameCandidates', () => {
  it('derives the first candidate from the name', () => {
    expect(usernameCandidates('Maria Lopez', 'x@example.com')[0]).toBe('maria_lopez');
  });

  it('strips accents and symbols', () => {
    expect(usernameCandidates('José Ángel!', 'x@example.com')[0]).toBe('jose_angel');
  });

  it('falls back to the email local part when the name is too short', () => {
    expect(usernameCandidates('Al', 'ana.garcia@example.com')[0]).toBe('ana_garcia');
  });

  it('falls back to a generic base when nothing usable is left', () => {
    expect(usernameCandidates('日本', 'a@example.com')[0]).toBe('reader');
  });

  it('adds numeric suffixes for the next candidates', () => {
    expect(usernameCandidates('Ana Ruiz', 'x@example.com')).toEqual([
      'ana_ruiz',
      'ana_ruiz2',
      'ana_ruiz3',
      'ana_ruiz4',
    ]);
  });

  it('never exceeds 20 characters, suffix included', () => {
    const list = usernameCandidates('a'.repeat(40), 'x@example.com');
    expect(list.every((c) => c.length <= 20)).toBe(true);
    expect(new Set(list).size).toBe(list.length);
  });
});
