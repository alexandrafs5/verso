import { normalizeIsbn } from '../../../infra/catalog/open-library-mappers';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OL_REF_RE = /^ol:(OL\d+)([WAM])$/;

export type CatalogRef = { kind: 'ol'; key: string } | { kind: 'local'; id: string };

export type RefType = 'W' | 'A' | 'M';

/**
 * Parses "ol:OL123W" or a UUID. `type` is the key suffix the caller expects
 * (W work, A author, M edition). Returns null for anything else.
 */
export function parseRef(ref: string, type: RefType): CatalogRef | null {
  if (UUID_RE.test(ref)) return { kind: 'local', id: ref };
  const match = OL_REF_RE.exec(ref);
  if (match && match[2] === type) return { kind: 'ol', key: `${match[1]}${match[2]}` };
  return null;
}

export const olRef = (key: string): string => `ol:${key}`;

export const isUuid = (value: string): boolean => UUID_RE.test(value);

/** ISBN-10 or ISBN-13 without hyphens or spaces, or null. */
export const parseIsbn = normalizeIsbn;

export function encodeCursor(page: number): string {
  return Buffer.from(JSON.stringify({ p: page }), 'utf8').toString('base64url');
}

/** Returns the page number, or null when the cursor is malformed. */
export function decodeCursor(cursor: string): number | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof value !== 'object' || value === null || !('p' in value)) return null;
    const page = (value as { p: unknown }).p;
    return typeof page === 'number' && Number.isInteger(page) && page >= 1 ? page : null;
  } catch {
    return null;
  }
}

/** Search query for the provider. `"` is stripped from the genre. */
export function buildSearchQuery(q: string, genre?: string): string {
  const cleanGenre = genre?.replace(/"/g, '').trim();
  return cleanGenre ? `${q} subject:"${cleanGenre}"` : q;
}

export const authorWorksQuery = (olAuthorKey: string): string => `author_key:${olAuthorKey}`;
