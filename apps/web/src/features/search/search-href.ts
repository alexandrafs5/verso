export function searchHref(q: string, genre?: string): string {
  const params = new URLSearchParams({ q });
  if (genre) params.set('genre', genre);
  return `/search?${params.toString()}`;
}
