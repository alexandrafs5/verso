import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, problem, renderWithProviders } from '../onboarding/test-utils';
import { RECENT_SEARCHES_KEY, resetRecentSearchesMemory } from './recent-searches';
import { TopBarSearch } from './TopBarSearch';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

function work(n: number) {
  return {
    ref: `ol:OL${n}W`,
    title: `Book ${n}`,
    authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
    firstPublishYear: 1955,
    coverUrl: null,
    editionCount: 3,
    libraryStatus: null,
  };
}

function stubFetch(handler: (url: string) => Response) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => Promise.resolve(handler(String(input))));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const sevenWorks = () => json({ items: [1, 2, 3, 4, 5, 6, 7].map(work), nextCursor: 'next' });

beforeEach(() => {
  nav.push.mockReset();
  window.localStorage.clear();
  resetRecentSearchesMemory();
});
afterEach(() => vi.unstubAllGlobals());

describe('TopBarSearch', () => {
  it('shows nothing on focus when there are no recents', async () => {
    renderWithProviders(<TopBarSearch />);
    await userEvent.click(screen.getByRole('combobox', { name: 'Search books' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows recents on focus, and removes one and clears all', async () => {
    window.localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(['dune', 'pedro']));
    renderWithProviders(<TopBarSearch />);
    await userEvent.click(screen.getByRole('combobox'));
    expect(await screen.findAllByRole('option')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Remove dune from recent searches' }));
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('["pedro"]');

    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('[]');
  });

  it('sends no request for 1 character and one request after the debounce for 2 or more', async () => {
    const fetchMock = stubFetch(sevenWorks);
    renderWithProviders(<TopBarSearch />);
    const field = screen.getByRole('combobox');
    await userEvent.type(field, 'd');
    await new Promise((r) => setTimeout(r, 400));
    expect(fetchMock).not.toHaveBeenCalled();

    await userEvent.type(field, 'un');
    await screen.findByRole('option', { name: /Book 1/ });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('q=dun');
  });

  it('lists at most 5 works plus the see-all item', async () => {
    stubFetch(sevenWorks);
    renderWithProviders(<TopBarSearch />);
    await userEvent.type(screen.getByRole('combobox'), 'book');
    await screen.findByRole('option', { name: /Book 5/ });
    expect(screen.queryByRole('option', { name: /Book 6/ })).not.toBeInTheDocument();
    expect(screen.getAllByRole('option')).toHaveLength(6);
    expect(screen.getByRole('option', { name: 'See all results' })).toBeInTheDocument();
  });

  it('opens the results page on Enter and stores the text in recents', async () => {
    stubFetch(sevenWorks);
    renderWithProviders(<TopBarSearch />);
    await userEvent.type(screen.getByRole('combobox'), 'Pedro{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/search?q=Pedro');
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('["Pedro"]');
  });

  it('moves with the arrow keys, updates aria-activedescendant and opens the work on Enter', async () => {
    stubFetch(sevenWorks);
    renderWithProviders(<TopBarSearch />);
    const field = screen.getByRole('combobox');
    await userEvent.type(field, 'book');
    await screen.findByRole('option', { name: /Book 1/ });
    expect(field).toHaveAttribute('aria-expanded', 'true');
    expect(field).not.toHaveAttribute('aria-activedescendant');

    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const second = screen.getAllByRole('option')[1] as HTMLElement;
    expect(field).toHaveAttribute('aria-activedescendant', second.id);
    expect(second).toHaveAttribute('aria-selected', 'true');

    await userEvent.keyboard('{ArrowUp}{Enter}');
    expect(nav.push).toHaveBeenCalledWith('/works/ol%3AOL1W');
  });

  it('wraps from the last option to the first and up from none to the last', async () => {
    stubFetch(sevenWorks);
    renderWithProviders(<TopBarSearch />);
    const field = screen.getByRole('combobox');
    await userEvent.type(field, 'book');
    await screen.findByRole('option', { name: /Book 1/ });
    const options = screen.getAllByRole('option');
    await userEvent.keyboard('{ArrowUp}');
    expect(field).toHaveAttribute('aria-activedescendant', options.at(-1)?.id);
    await userEvent.keyboard('{ArrowDown}');
    expect(field).toHaveAttribute('aria-activedescendant', options[0]?.id);
  });

  it('closes on Escape keeping the text, and on a click outside', async () => {
    stubFetch(sevenWorks);
    renderWithProviders(
      <div>
        <TopBarSearch />
        <button type="button">outside</button>
      </div>,
    );
    const field = screen.getByRole('combobox');
    await userEvent.type(field, 'book');
    await screen.findByRole('option', { name: /Book 1/ });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(field).toHaveValue('book');

    await userEvent.type(field, 's');
    await screen.findByRole('listbox');
    await userEvent.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the no-match message for an empty result', async () => {
    stubFetch(() => json({ items: [], nextCursor: null }));
    renderWithProviders(<TopBarSearch />);
    await userEvent.type(screen.getByRole('combobox'), 'zzzz');
    expect(await screen.findByText('No books match ‘zzzz’')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'See all results' })).toBeInTheDocument();
  });

  it('shows an error with retry and still opens the results page on Enter', async () => {
    let fail = true;
    stubFetch(() => (fail ? problem(500, 'INTERNAL') : sevenWorks()));
    renderWithProviders(<TopBarSearch />);
    const field = screen.getByRole('combobox');
    await userEvent.type(field, 'dune');
    expect(await screen.findByRole('alert')).toHaveTextContent('Search is not available');

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('option', { name: /Book 1/ });

    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith('/search?q=dune'));
  });

  it('opens the results page from the see-all item', async () => {
    stubFetch(sevenWorks);
    renderWithProviders(<TopBarSearch />);
    await userEvent.type(screen.getByRole('combobox'), 'book');
    await userEvent.click(await screen.findByRole('option', { name: 'See all results' }));
    expect(nav.push).toHaveBeenCalledWith('/search?q=book');
    expect(window.localStorage.getItem(RECENT_SEARCHES_KEY)).toBe('["book"]');
  });
});
