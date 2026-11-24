export const queryKeys = {
  health: ['health'] as const,
  me: ['me'] as const,
  usernameAvailability: (username: string) => ['username-availability', username] as const,
  searchBooks: (q: string, genre?: string) => ['search', 'books', q, genre ?? null] as const,
};
