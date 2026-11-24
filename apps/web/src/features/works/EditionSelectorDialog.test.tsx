import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, renderWithProviders } from '../onboarding/test-utils';
import { WorkPage } from './WorkPage';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const work = {
  ref: 'ol:OL1W',
  title: 'Pedro Páramo',
  subtitle: null,
  description: null,
  firstPublishYear: 1955,
  coverUrl: 'https://covers.example/work.jpg',
  authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
  genres: [],
  series: null,
  source: 'OPEN_LIBRARY',
  libraryStatus: null,
};

const edition = (ref: string, extra: Record<string, unknown> = {}) => ({
  ref,
  title: 'Pedro Páramo',
  isbn10: null,
  isbn13: null,
  publisher: null,
  publishYear: null,
  language: null,
  pageCount: null,
  format: 'PAPERBACK',
  coverUrl: null,
  ...extra,
});

const spanish = edition('ol:OL1M', {
  language: 'es',
  publisher: 'Cátedra',
  publishYear: 1955,
  pageCount: 128,
  isbn13: '9788437604947',
  coverUrl: 'https://covers.example/es.jpg',
});
const english = edition('ol:OL2M', {
  language: 'en',
  publisher: 'Grove',
  publishYear: 1994,
  pageCount: 144,
  format: 'HARDCOVER',
  isbn10: '0802133908',
});
const noLanguage = edition('ol:OL3M', { publishYear: 2001 });

function open(editions: unknown[]) {
  const fetchMock = mockApi({
    'GET /api/v1/works/ol%3AOL1W': () => json(work),
    'GET /api/v1/works/ol%3AOL1W/editions': () => json(editions),
  });
  renderWithProviders(<WorkPage workRef="ol:OL1W" />);
  return fetchMock;
}

afterEach(() => vi.unstubAllGlobals());

describe('EditionSelectorDialog', () => {
  it('opens a modal with the editions and marks the current one Selected', async () => {
    open([spanish, english, noLanguage]);
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));

    const dialog = screen.getByRole('dialog', { name: 'Choose an edition' });
    const rows = within(dialog).getAllByRole('listitem');
    expect(rows).toHaveLength(3);
    // The UI is English, so the English edition is the default, not the first one listed.
    expect(within(rows[0] as HTMLElement).queryByText('Selected')).not.toBeInTheDocument();
    expect(within(rows[1] as HTMLElement).getByText('Selected')).toBeVisible();
    expect(within(rows[0] as HTMLElement).getByText('Spanish · Cátedra · 1955')).toBeVisible();
    expect(
      within(rows[0] as HTMLElement).getByText('128 pages · Paperback · ISBN 9788437604947'),
    ).toBeVisible();
    // ISBN-13 first, else ISBN-10. Null parts are omitted.
    expect(
      within(rows[1] as HTMLElement).getByText('144 pages · Hardcover · ISBN 0802133908'),
    ).toBeVisible();
    expect(within(rows[2] as HTMLElement).queryByText('Selected')).not.toBeInTheDocument();
    expect(within(rows[2] as HTMLElement).getByText('2001')).toBeVisible();
  });

  it('lists the distinct languages as chips and filters on the client', async () => {
    const fetchMock = open([spanish, english, noLanguage]);
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));
    const dialog = screen.getByRole('dialog');

    const group = within(dialog).getByRole('group', { name: 'Filter by language' });
    const chips = within(group).getAllByRole('button');
    expect(chips.map((chip) => chip.textContent)).toEqual(['All', 'Spanish', 'English']);
    expect(chips[0]).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(within(group).getByRole('button', { name: 'English' }));
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(within(dialog).getByText(/Grove/)).toBeVisible();
    await userEvent.click(within(group).getByRole('button', { name: 'All' }));
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(3);

    // Filtering never calls the API again.
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('language='))).toHaveLength(
      0,
    );
  });

  it('selecting another edition closes the modal and updates S3', async () => {
    open([spanish, english]);
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));

    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /English · Grove/ }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Edition: English · Grove · 1994 · 144 pages')).toBeVisible();
    expect(screen.getByText('First published 1955 · 144 pages')).toBeVisible();
    // The chosen edition has no cover, so the work cover stays.
    expect(document.querySelector('img[src="https://covers.example/work.jpg"]')).not.toBeNull();
  });

  it('keeps the work cover until an edition is chosen, then shows that edition cover', async () => {
    open([english, spanish]);
    await screen.findByRole('button', { name: 'Change' });
    const cover = () => document.querySelector('img[alt="Cover of Pedro Páramo"]');
    expect(cover()).toHaveAttribute('src', 'https://covers.example/work.jpg');

    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: /Spanish · Cátedra/ }),
    );
    expect(cover()).toHaveAttribute('src', 'https://covers.example/es.jpg');
  });

  it('closes with Escape and the close button, and returns focus to Change', async () => {
    open([spanish, english]);
    const change = await screen.findByRole('button', { name: 'Change' });
    await userEvent.click(change);
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' })).toBeVisible();

    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Radix restores focus on the next tick.
    await waitFor(() => expect(change).toHaveFocus());

    await userEvent.click(change);
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Radix restores focus on the next tick.
    await waitFor(() => expect(change).toHaveFocus());
  });

  it('shows one edition marked Selected and no language chips', async () => {
    open([spanish]);
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getAllByRole('listitem')).toHaveLength(1);
    expect(within(dialog).getByText('Selected')).toBeVisible();
    expect(within(dialog).queryByRole('group', { name: 'Filter by language' })).toBeNull();
  });

  it('resets the filter when the modal is opened again', async () => {
    open([spanish, english]);
    await userEvent.click(await screen.findByRole('button', { name: 'Change' }));
    await userEvent.click(screen.getByRole('button', { name: 'English' }));
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(within(screen.getByRole('dialog')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows no Change button when the work has no editions', async () => {
    open([]);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });
});
