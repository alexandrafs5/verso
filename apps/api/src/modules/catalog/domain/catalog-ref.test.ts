import { describe, expect, it } from 'vitest';
import {
  authorWorksQuery,
  buildSearchQuery,
  decodeCursor,
  encodeCursor,
  olRef,
  parseIsbn,
  parseRef,
} from './catalog-ref';

const UUID = '0190f0f0-1234-7abc-8def-0123456789ab';

describe('parseRef', () => {
  it('parses an Open Library key of the expected type', () => {
    expect(parseRef('ol:OL1731119W', 'W')).toEqual({ kind: 'ol', key: 'OL1731119W' });
    expect(parseRef('ol:OL9A', 'A')).toEqual({ kind: 'ol', key: 'OL9A' });
    expect(parseRef('ol:OL5M', 'M')).toEqual({ kind: 'ol', key: 'OL5M' });
  });

  it('parses a UUID for any type', () => {
    expect(parseRef(UUID, 'W')).toEqual({ kind: 'local', id: UUID });
    expect(parseRef(UUID.toUpperCase(), 'A')).toEqual({ kind: 'local', id: UUID.toUpperCase() });
  });

  it('rejects a key of another type and malformed refs', () => {
    expect(parseRef('ol:OL9A', 'W')).toBeNull();
    expect(parseRef('ol:OL9W', 'A')).toBeNull();
    expect(parseRef('OL9W', 'W')).toBeNull();
    expect(parseRef('ol:OL9W/../x', 'W')).toBeNull();
    expect(parseRef('/works/OL9W', 'W')).toBeNull();
    expect(parseRef('', 'W')).toBeNull();
  });

  it('builds an ol ref from a key', () => {
    expect(olRef('OL1W')).toBe('ol:OL1W');
  });
});

describe('cursor', () => {
  it('round-trips a page number', () => {
    expect(decodeCursor(encodeCursor(2))).toBe(2);
  });

  it('returns null for malformed cursors', () => {
    const encode = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
    expect(decodeCursor('not-a-cursor')).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor(encode({ p: 0 }))).toBeNull();
    expect(decodeCursor(encode({ p: 1.5 }))).toBeNull();
    expect(decodeCursor(encode({ p: '2' }))).toBeNull();
    expect(decodeCursor(encode({ x: 2 }))).toBeNull();
    expect(decodeCursor(encode(null))).toBeNull();
  });
});

describe('buildSearchQuery', () => {
  it('returns q alone without a genre', () => {
    expect(buildSearchQuery('Pedro Páramo')).toBe('Pedro Páramo');
  });

  it('appends a subject clause', () => {
    expect(buildSearchQuery('Pedro Páramo', 'Fiction')).toBe('Pedro Páramo subject:"Fiction"');
  });

  it('strips double quotes from the genre', () => {
    expect(buildSearchQuery('a', 'Sci"fi" ')).toBe('a subject:"Scifi"');
  });

  it('ignores a genre that is empty after stripping', () => {
    expect(buildSearchQuery('a', '""')).toBe('a');
  });

  it('returns the subject clause alone without q', () => {
    expect(buildSearchQuery(undefined, 'Fiction')).toBe('subject:"Fiction"');
    expect(buildSearchQuery(undefined, 'Sci"fi"')).toBe('subject:"Scifi"');
  });

  it('returns an empty string when nothing is left to search', () => {
    expect(buildSearchQuery(undefined)).toBe('');
    expect(buildSearchQuery(undefined, '""')).toBe('');
  });
});

describe('helpers', () => {
  it('builds the author works query', () => {
    expect(authorWorksQuery('OL9A')).toBe('author_key:OL9A');
  });

  it('normalizes ISBNs', () => {
    expect(parseIsbn('978-84-376-0494-7')).toBe('9788437604947');
    expect(parseIsbn('12345')).toBeNull();
  });
});
