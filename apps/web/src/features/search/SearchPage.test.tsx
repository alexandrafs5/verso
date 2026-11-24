import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, problem, renderWithProviders } from '../onboarding/test-utils';
import { RECENT_SEARCHES_KEY, resetRecentSearchesMemory } from './recent-searches';
import { SearchPage } from './SearchPage';

const nav = vi.hoisted(() => ({ push: vi.fn(), search: '' }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

function work(ref: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    ref,
    title,
    authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
    firstPublishYear: 1955,
    coverUrl: null,
    editionCount: 12,
    libraryStatus: null,
    ...extra,
  };
}

function stubFetch(handler: (url: string) => Response | Promise<Response>) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(() => {
  nav.push.mockReset();
  nav.search = '';
  window.localStorage.clear();
  resetRecentSearchesMemory();
});
afterEach(() => vi.unstubAllGlobals());

describe('SearchPage', () => {
  it('shows the prompt, focuses the field and sends no request without q', () => {
    const fetchMock = stubFetch(() => json({}));
    renderWithProviders(<SearchPage />);
    expect(screen.getByText('Search for a book')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search books' })).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders rows linking to the encoded work ref', async () => {
    nav.search = 'q=Pedro+P%C3%A1ramo';
    stubFetch(() =>
      json({
        items: [work('ol:OL1W', 'Pedro Páramo'), work('ol:OL2W', 'Other', { editionCount: null })],
        moreMatches: [],
        nextCursor: null,
      }),
    );
    renderWithProviders(<SearchPage />);
    const link = await screen.findByRole('link', { name: /Pedro Páramo/ });
    expect(link).toHaveAttribute('href', '/works/ol%3AOL1W');
    expect(link).toHaveTextContent('by Juan Rulfo');
    expect(link).toHaveTextContent('1955 · 12 editions');
    expect(screen.getByRole('link', { name: /Other/ })).not.toHaveTextContent('editions');
    expect(screen.getByRole('link', { name: /add it manually/i })).toHaveAttribute(
      'href',
      '/books/new',
    );
    expect(screen.queryByRole('button', { name: /want to read/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('loads more with the cursor and hides the button on the last page', async () => {
    nav.search = 'q=dune';
    const fetchMock = stubFetch((url) =>
      url.includes('cursor=c2')
        ? json({ items: [work('ol:OL2W', 'Second')], moreMatches: [], nextCursor: null })
        : json({ items: [work('ol:OL1W', 'First')], moreMatches: [], nextCursor: 'c2' }),
    );
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /First/ });
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    await screen.findByRole('link', { name: /Second/ });
    expect(screen.getByRole('link', { name: /First/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('sends the genre, shows the chip and drops only genre when removed', async () => {
    nav.search = 'q=dune&genre=Fiction';
    const fetchMock = stubFetch(() =>
      json({ items: [work('ol:OL1W', 'Dune')], moreMatches: [], nextCursor: null }),
    );
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Dune/ });
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('genre=Fiction');
    expect(screen.getByText('Genre: Fiction')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove genre filter Fiction' }));
    expect(nav.push).toHaveBeenCalledWith('/search?q=dune');
  });

  it('keeps the genre and stores the text in recents on submit', async () => {
    nav.search = 'q=dune&genre=Fiction';
    stubFetch(() => json({ items: [work('ol:OL1W', 'Dune')], moreMatches: [], nextCursor: null }));
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Dune/ });
    const field = screen.getByRole('searchbox');
    await userEvent.clear(field);
    await userEvent.type(field, 'Pedro{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/search?q=Pedro&genre=Fiction');
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('["Pedro"]');
  });

  it('shows the empty state with the manual add link when nothing matches', async () => {
    nav.search = 'q=zzzz';
    stubFetch(() => json({ items: [], moreMatches: [], nextCursor: null }));
    renderWithProviders(<SearchPage />);
    expect(await screen.findByRole('status')).toHaveTextContent('No books match ‘zzzz’');
    expect(screen.getByRole('heading', { name: 'No books match ‘zzzz’' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add it manually/i })).toBeInTheDocument();
  });

  it('shows the prompt and sends no request for q over 200 characters', () => {
    nav.search = `q=${'a'.repeat(201)}`;
    const fetchMock = stubFetch(() => json({}));
    renderWithProviders(<SearchPage />);
    expect(screen.getByText('Search for a book')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows an error with retry and keeps the typed query', async () => {
    nav.search = 'q=dune';
    let fail = true;
    stubFetch(() =>
      fail
        ? problem(500, 'INTERNAL')
        : json({ items: [work('ol:OL1W', 'Dune')], moreMatches: [], nextCursor: null }),
    );
    renderWithProviders(<SearchPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('We couldn’t load the results');
    expect(screen.getByRole('searchbox')).toHaveValue('dune');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('link', { name: /Dune/ });
  });

  it('explains rate limiting', async () => {
    nav.search = 'q=dune';
    stubFetch(() => problem(429, 'RATE_LIMITED'));
    renderWithProviders(<SearchPage />);
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Too many searches'));
  });

  it('keeps loaded rows and shows an error when load more fails', async () => {
    nav.search = 'q=dune';
    stubFetch((url) =>
      url.includes('cursor=')
        ? problem(500, 'INTERNAL')
        : json({ items: [work('ol:OL1W', 'First')], moreMatches: [], nextCursor: 'c2' }),
    );
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /First/ });
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(await screen.findByText('We couldn’t load more results.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /First/ })).toBeInTheDocument();
  });

  it('shows the prompt and sends no request for a genre over 80 characters', () => {
    nav.search = `q=dune&genre=${'g'.repeat(81)}`;
    const fetchMock = stubFetch(() => json({}));
    renderWithProviders(<SearchPage />);
    expect(screen.getByText('Search for a book')).toBeInTheDocument();
    expect(screen.queryByText(/^Genre:/)).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats a blank genre as no genre', async () => {
    nav.search = 'q=dune&genre=%20%20';
    const fetchMock = stubFetch(() =>
      json({ items: [work('ol:OL1W', 'Dune')], moreMatches: [], nextCursor: null }),
    );
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Dune/ });
    expect(String(fetchMock.mock.calls[0]?.[0])).not.toContain('genre=');
    expect(screen.queryByText(/^Genre:/)).not.toBeInTheDocument();
  });

  it('shows the fold button with the folded count and expands it', async () => {
    nav.search = 'q=pedro';
    stubFetch(() =>
      json({
        items: [work('ol:OL1W', 'Pedro Páramo')],
        moreMatches: [
          work('ol:OL7W', 'Study one', { editionCount: 1 }),
          work('ol:OL8W', 'Study two', { editionCount: 1 }),
        ],
        nextCursor: null,
      }),
    );
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Pedro Páramo/ });
    expect(screen.queryByRole('link', { name: /Study one/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show more matches (2)' }));
    expect(screen.getByRole('link', { name: /Study one/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Study two/ })).toBeVisible();
  });

  it('has no fold button when nothing is folded', async () => {
    nav.search = 'q=dune';
    stubFetch(() => json({ items: [work('ol:OL1W', 'Dune')], moreMatches: [], nextCursor: null }));
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Dune/ });
    expect(screen.queryByRole('button', { name: /more matches/i })).not.toBeInTheDocument();
  });

  it('collects folded works from every loaded page into one button', async () => {
    nav.search = 'q=pedro';
    stubFetch((url) =>
      url.includes('cursor=')
        ? json({
            items: [],
            moreMatches: [work('ol:OL9W', 'Study three', { editionCount: 1 })],
            nextCursor: null,
          })
        : json({
            items: [work('ol:OL1W', 'Pedro Páramo')],
            moreMatches: [work('ol:OL7W', 'Study one', { editionCount: 1 })],
            nextCursor: 'c2',
          }),
    );
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Pedro Páramo/ });
    expect(screen.getByRole('button', { name: 'Show more matches (1)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Load more' }));
    expect(
      await screen.findByRole('button', { name: 'Show more matches (2)' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /more matches/i })).toHaveLength(1);
  });

  it('shows the fold button even when the loaded pages have no main rows', async () => {
    nav.search = 'q=pedro';
    stubFetch(() =>
      json({
        items: [],
        moreMatches: [work('ol:OL7W', 'Study one', { editionCount: 1 })],
        nextCursor: null,
      }),
    );
    renderWithProviders(<SearchPage />);
    expect(
      await screen.findByRole('button', { name: 'Show more matches (1)' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/No books match/)).not.toBeInTheDocument();
  });

  it('announces how many results loaded', async () => {
    nav.search = 'q=dune';
    stubFetch(() => json({ items: [work('ol:OL1W', 'Dune')], moreMatches: [], nextCursor: null }));
    renderWithProviders(<SearchPage />);
    await screen.findByRole('link', { name: /Dune/ });
    expect(screen.getByRole('status')).toHaveTextContent('1 result loaded');
  });
});
