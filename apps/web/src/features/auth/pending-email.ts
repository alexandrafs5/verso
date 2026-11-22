export const PENDING_EMAIL_KEY = 'verso:pending-verification-email';

// Fallback when sessionStorage is unavailable (private mode, blocked site data).
let memoryEmail: string | null = null;

export function getPendingEmail(): string | null {
  try {
    const stored = window.sessionStorage.getItem(PENDING_EMAIL_KEY);
    if (stored) return stored;
  } catch {
    // Storage unavailable: use the in-memory value.
  }
  return memoryEmail;
}

export function setPendingEmail(email: string): void {
  memoryEmail = email;
  try {
    window.sessionStorage.setItem(PENDING_EMAIL_KEY, email);
  } catch {
    // Kept in memory only.
  }
}

export function clearPendingEmail(): void {
  memoryEmail = null;
  try {
    window.sessionStorage.removeItem(PENDING_EMAIL_KEY);
  } catch {
    // Nothing to clear.
  }
}
