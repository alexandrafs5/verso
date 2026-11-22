const MAX_LENGTH = 20;
const FALLBACK = 'reader';

function slug(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Candidate usernames derived from the display name, else the email's local part. Pure: the
 * caller checks each one for availability, in order. The server policy stays the authority.
 */
export function usernameCandidates(name: string, email: string, count = 4): string[] {
  const fromName = slug(name);
  const fromEmail = slug(email.split('@')[0] ?? '');
  const picked = fromName.length >= 3 ? fromName : fromEmail;
  const base = (picked.length >= 3 ? picked : FALLBACK).slice(0, MAX_LENGTH);

  const candidates = [base];
  for (let n = 2; candidates.length < count; n++) {
    const suffix = String(n);
    candidates.push(`${base.slice(0, MAX_LENGTH - suffix.length)}${suffix}`);
  }
  return candidates;
}
