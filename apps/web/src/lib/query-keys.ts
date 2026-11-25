export const queryKeys = {
  health: ['health'] as const,
  me: ['me'] as const,
  usernameAvailability: (username: string) => ['username-availability', username] as const,
  searchBooks: (q: string, genre?: string) => ['search', 'books', q, genre ?? null] as const,
  work: (ref: string) => ['catalog', 'work', ref] as const,
  workEditions: (ref: string) => ['catalog', 'work', ref, 'editions'] as const,
  author: (ref: string) => ['catalog', 'author', ref] as const,
  series: (id: string) => ['catalog', 'series', id] as const,
};
