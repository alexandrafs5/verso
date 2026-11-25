/** Up to two initials: first letter of the first and the last word. */
export function authorInitials(name: string): string {
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const first = words[0] as string;
  const last = words.length > 1 ? (words[words.length - 1] as string) : '';
  return `${[...first][0] ?? ''}${[...last][0] ?? ''}`.toUpperCase();
}
