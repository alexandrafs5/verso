import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, problem, renderWithProviders } from '../onboarding/test-utils';
import { authorInitials } from './author-utils';
import { AuthorPage } from './AuthorPage';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

const summary = (ref: string, title: string, year: number | null) => ({
  ref,
  title,
  authors: [],
  firstPublishYear: year,
  coverUrl: null,
  editionCount: 3,
  libraryStatus: null,
});

const author = (extra: Record<string, unknown> = {}) => ({
  ref: 'ol:OL1A',
  name: 'Juan Rulfo',
  bio: 'Mexican writer.',
  birthYear: 1917,
  deathYear: 1986,
  photoUrl: null,
  works: [
    summary('ol:OL3W', 'Undated', null),
    summary('ol:OL2W', 'El llano en llamas', 1953),
    summary('ol:OL1W', 'Pedro Páramo', 1955),
    summary('ol:OL4W', 'Another 1955', 1955),
  ],
  ...extra,
});

function open(response: Response) {
  const fetchMock = mockApi({ 'GET /api/v1/authors/ol%3AOL1A': () => response });
  renderWithProviders(<AuthorPage authorRef="ol:OL1A" />);
  return fetchMock;
}

beforeEach(() => nav.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('authorInitials', () => {
  it('takes the first letter of the first and the last word', () => {
    expect(authorInitials('Juan Rulfo')).toBe('JR');
    expect(authorInitials('Gabriel José García Márquez')).toBe('GM');
    expect(authorInitials('Homer')).toBe('H');
    expect(authorInitials('  ')).toBe('');
  });
});

describe('AuthorPage', () => {
  it('shows the name, life years, biography and the works in the order the API gives', async () => {
    open(json(author()));
    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Rulfo' })).toBeVisible();
    expect(screen.getByText('1917–1986')).toBeVisible();
    expect(screen.getByText('Mexican writer.')).toBeVisible();

    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links.map((link) => link.textContent)).toEqual([
      expect.stringContaining('Undated'),
      expect.stringContaining('El llano en llamas'),
      expect.stringContaining('Pedro Páramo'),
      expect.stringContaining('Another 1955'),
    ]);
    expect(links[2]).toHaveAttribute('href', '/works/ol%3AOL1W');
  });

  it('shows "born" years alone and hides unknown life years and an empty bio', async () => {
    open(json(author({ deathYear: null, bio: null })));
    expect(await screen.findByText('1917–')).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Biography' })).not.toBeInTheDocument();
  });

  it('hides the life years when the birth year is unknown', async () => {
    open(json(author({ birthYear: null, deathYear: null })));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/\d{4}–/)).not.toBeInTheDocument();
  });

  it('shows initials when there is no photo, and the photo when there is one', async () => {
    open(json(author()));
    const fallback = await screen.findByRole('img', { name: 'Photo of Juan Rulfo' });
    expect(fallback).toHaveTextContent('JR');
    expect(fallback.tagName).not.toBe('IMG');
  });

  it('uses the photo when the URL is set', async () => {
    open(json(author({ photoUrl: 'https://photos.example/rulfo.jpg' })));
    const photo = await screen.findByRole('img', { name: 'Photo of Juan Rulfo' });
    expect(photo).toHaveAttribute('src', 'https://photos.example/rulfo.jpg');
  });

  it('shows an empty state for an author with no works', async () => {
    open(json(author({ works: [] })));
    expect(await screen.findByText('No books found for this author')).toBeVisible();
  });

  it('shows a Back button', async () => {
    open(json(author()));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  it('shows no status badge on books outside the library, and no add control', async () => {
    open(json(author()));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/Want to read|Reading|Read\b|Add to library/)).toBeNull();
  });

  it('puts a status badge, part of the link name, on books in the library', async () => {
    const saved = (status: string, readCount: number) => ({
      libraryStatus: {
        userBookId: '0190f0f0-1234-7abc-8def-0123456789ab',
        status,
        readCount,
        editionRef: 'ol:OL1M',
      },
    });
    open(
      json(
        author({
          works: [
            { ...summary('ol:OL1W', 'Pedro Páramo', 1955), ...saved('READ', 2) },
            { ...summary('ol:OL2W', 'El llano en llamas', 1953), ...saved('READING', 1) },
            summary('ol:OL3W', 'Undated', null),
          ],
        }),
      ),
    );
    await screen.findByRole('heading', { level: 1 });

    const links = within(screen.getByRole('list')).getAllByRole('link');
    expect(links[0]).toHaveAccessibleName(/Read.*Read 2 times/);
    expect(within(links[0] as HTMLElement).getByText('×2')).toHaveAttribute('aria-hidden', 'true');
    expect(links[1]).toHaveAccessibleName(/Reading/);
    expect(within(links[1] as HTMLElement).queryByText(/×/)).not.toBeInTheDocument();
    expect(links[2]).not.toHaveAccessibleName(/Reading|Read\b/);
    expect(screen.queryByRole('button', { name: /Want to read/ })).not.toBeInTheDocument();
  });

  it('shows the not-found state for a 404', async () => {
    open(problem(404, 'CATALOG_NOT_FOUND'));
    expect(await screen.findByText('Author not found')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Search for a book' }));
    expect(nav.push).toHaveBeenCalledWith('/search');
  });

  // A real 503 is retried by the API client with backoff (up to 75 s) before this state shows,
  // so the test uses a non-retryable 500.
  it('shows an error with Retry for a server error', async () => {
    let calls = 0;
    mockApi({
      'GET /api/v1/authors/ol%3AOL1A': () =>
        ++calls === 1 ? problem(500, 'INTERNAL_ERROR') : json(author()),
    });
    renderWithProviders(<AuthorPage authorRef="ol:OL1A" />);
    expect(await screen.findByText('We couldn’t load this author')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Juan Rulfo' })).toBeVisible();
  });

  it('shows a rate-limit message for a 429', async () => {
    open(problem(429, 'RATE_LIMITED'));
    expect(
      await screen.findByText('Too many requests. Wait a moment and try again.'),
    ).toBeVisible();
  });
});
