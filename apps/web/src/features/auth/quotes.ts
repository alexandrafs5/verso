export type AuthQuote = { text: string; author: string };

// Public-domain source text, deliberately not translated (SPEC 09).
export const AUTH_QUOTES: readonly AuthQuote[] = [
  {
    text: 'There is no Frigate like a Book to take us Lands away.',
    author: 'Emily Dickinson',
  },
  {
    text: 'There is no enjoyment like reading! How much sooner one tires of any thing than of a book!',
    author: 'Jane Austen',
  },
  {
    text: 'Books are the best of things, well used; abused, among the worst.',
    author: 'Ralph Waldo Emerson',
  },
  {
    text: 'Some books are to be tasted, others to be swallowed, and some few to be chewed and digested.',
    author: 'Francis Bacon',
  },
  {
    text: 'The reading of all good books is like a conversation with the finest men of past centuries.',
    author: 'René Descartes',
  },
  {
    text: 'A man ought to read just as inclination leads him; for what he reads as a task will do him little good.',
    author: 'Samuel Johnson',
  },
  {
    text: 'Reading is to the mind what exercise is to the body.',
    author: 'Richard Steele',
  },
  {
    text: 'A good book is the precious life-blood of a master spirit, embalmed and treasured up on purpose to a life beyond life.',
    author: 'John Milton',
  },
  {
    text: 'The true university of these days is a collection of books.',
    author: 'Thomas Carlyle',
  },
  {
    text: 'Read the best books first, or you may not have a chance to read them at all.',
    author: 'Henry David Thoreau',
  },
  {
    text: 'I can read any thing which I call a book.',
    author: 'Charles Lamb',
  },
  {
    text: 'The books that the world calls immoral are books that show the world its own shame.',
    author: 'Oscar Wilde',
  },
];

/** Picks a quote. `random` is injectable so tests stay deterministic. */
export function pickQuote(random: () => number = Math.random): AuthQuote {
  const index = Math.min(AUTH_QUOTES.length - 1, Math.floor(random() * AUTH_QUOTES.length));
  return AUTH_QUOTES[index] as AuthQuote;
}
