export const COVER_TONES = ['wine', 'tobacco', 'forest', 'navy', 'oxblood', 'slate'] as const;

export type CoverTone = (typeof COVER_TONES)[number];

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** FNV-1a 32-bit over the UTF-8 bytes of `text`. */
function fnv1a32(text: string): number {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= byte;
    hash = Math.imul(hash, FNV_PRIME);
  }
  return hash >>> 0;
}

/** Deterministic tone for a book without a cover. Same title (ignoring case and edge spaces) gives the same tone. */
export function pickCoverTone(title: string): CoverTone {
  const normalized = title.trim().toLowerCase();
  if (normalized === '') return COVER_TONES[0];
  return COVER_TONES[fnv1a32(normalized) % COVER_TONES.length]!;
}
