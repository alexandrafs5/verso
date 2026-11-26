import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, problem, renderWithProviders } from '../onboarding/test-utils';
import { SeriesPage } from './SeriesPage';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

const ID = '0190f0f0-1234-7abc-8def-0123456789ab';

const entry = (ref: string, title: string, position: number | null, year: number | null) => ({
  ref,
  title,
  authors: [],
  firstPublishYear: year,
  coverUrl: null,
  editionCount: 2,
  libraryStatus: null,
  position,
});

const series = (works: unknown[] = []) => ({
  id: ID,
  name: 'The Saga',
  works: works.length
    ? works
    : [
        entry('ol:OL1W', 'First', 1, 2001),
        entry('ol:OL2W', 'Second', 2, 2002),
        entry('ol:OL3W', 'Third', 3, 2003),
        entry('ol:OL0W', 'Unnumbered', null, null),
      ],
});

function open(response: Response) {
  mockApi({ [`GET /api/v1/series/${ID}`]: () => response });
  renderWithProviders(<SeriesPage seriesId={ID} />);
}

beforeEach(() => nav.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('SeriesPage', () => {
  it('shows the series name and the works in order with number, title and year', async () => {
    open(json(series()));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Saga' })).toBeVisible();

    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    // The generated cover repeats the title as text, so match on the first title found.
    const order = items.map((item) => /First|Second|Third|Unnumbered/.exec(item.textContent)?.[0]);
    expect(order).toEqual(['First', 'Second', 'Third', 'Unnumbered']);
    expect(within(items[0] as HTMLElement).getByText('1')).toBeVisible();
    expect(within(items[0] as HTMLElement).getByText('2001')).toBeVisible();
    expect(within(items[1] as HTMLElement).getByText('2')).toBeVisible();
    // No position and no year: no digits at all.
    expect(items[3]?.textContent).not.toMatch(/[0-9]/);
    const link = within(items[0] as HTMLElement).getByRole('link');
    expect(link).toHaveAttribute('href', '/works/ol%3AOL1W');
  });

  it('lists a series derived from Open Library in the order the API gives, with no numbers', async () => {
    const id = 'ol:A Song of Ice and Fire';
    mockApi({
      [`GET /api/v1/series/${encodeURIComponent(id)}`]: () =>
        json({
          id,
          name: 'A Song of Ice and Fire',
          works: [
            entry('ol:OL1W', 'A Game of Thrones', null, 1996),
            entry('ol:OL2W', 'A Clash of Kings', null, 1998),
            entry('ol:OL5W', 'A Dance With Dragons', null, 2008),
          ],
        }),
    });
    renderWithProviders(<SeriesPage seriesId={id} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'A Song of Ice and Fire' }),
    ).toBeVisible();
    const items = within(screen.getByRole('list')).getAllByRole('listitem');
    const order = items.map(
      (item) => /Game of Thrones|Clash of Kings|Dance With Dragons/.exec(item.textContent)?.[0],
    );
    expect(order).toEqual(['Game of Thrones', 'Clash of Kings', 'Dance With Dragons']);
    expect(within(items[0] as HTMLElement).getByText('1996')).toBeVisible();
    expect(within(items[0] as HTMLElement).getByRole('link')).toHaveAttribute(
      'href',
      '/works/ol%3AOL1W',
    );
  });

  it('shows a Back button', async () => {
    open(json(series()));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  const saved = (status: string, readCount: number) => ({
    libraryStatus: { userBookId: ID, status, readCount, editionRef: 'ol:OL1M' },
  });

  it('shows a control on every row, never inside the row link', async () => {
    open(json(series()));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByText('You’ve read 0 of 4')).toBeVisible();
    expect(screen.getAllByRole('button', { name: /^Want to read: / })).toHaveLength(4);
    expect(document.querySelector('a button')).toBeNull();
  });

  it('counts the books with a finished reading, whatever their status', async () => {
    open(
      json(
        series([
          { ...entry('ol:OL1W', 'First', 1, 2001), ...saved('READ', 1) },
          // A reread in progress still counts.
          { ...entry('ol:OL2W', 'Second', 2, 2002), ...saved('READING', 2) },
          { ...entry('ol:OL3W', 'Third', 3, 2003), ...saved('READING', 0) },
          entry('ol:OL4W', 'Fourth', 4, 2004),
        ]),
      ),
    );
    expect(await screen.findByText('You’ve read 2 of 4')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Reading' })).toHaveLength(2);
    expect(screen.getByText('×2')).toBeInTheDocument();
  });

  it('updates the status and the count after an add', async () => {
    const fetchMock = mockApi({
      [`GET /api/v1/series/${ID}`]: () => json(series([entry('ol:OL1W', 'First', 1, 2001)])),
      'POST /api/v1/library': () => json({ ...saved('READ', 1).libraryStatus, workRef: ID }, 201),
    });
    renderWithProviders(<SeriesPage seriesId={ID} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Choose a status for First' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Read' }));

    expect(await screen.findByText('You’ve read 1 of 1')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Read' })).toBeDisabled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shows an empty state without a count for a series with no works', async () => {
    open(json({ id: ID, name: 'The Saga', works: [] }));
    expect(await screen.findByText('No books found in this series')).toBeVisible();
    expect(screen.queryByText(/You’ve read/)).not.toBeInTheDocument();
  });

  it('shows the not-found state for a 404 and for an invalid id', async () => {
    open(problem(404, 'CATALOG_NOT_FOUND'));
    expect(await screen.findByText('Series not found')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Search for a book' }));
    expect(nav.push).toHaveBeenCalledWith('/search');
  });

  it('shows the not-found state for an invalid id', async () => {
    open(problem(400, 'INVALID_REF'));
    expect(await screen.findByText('Series not found')).toBeVisible();
  });

  // A real 503 is retried by the API client with backoff (up to 75 s) before this state shows,
  // so the test uses a non-retryable 500.
  it('shows an error with Retry for a server error', async () => {
    let calls = 0;
    mockApi({
      [`GET /api/v1/series/${ID}`]: () =>
        ++calls === 1 ? problem(500, 'INTERNAL_ERROR') : json(series()),
    });
    renderWithProviders(<SeriesPage seriesId={ID} />);
    expect(await screen.findByText('We couldn’t load this series')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'The Saga' })).toBeVisible();
  });

  it('shows a rate-limit message for a 429', async () => {
    open(problem(429, 'RATE_LIMITED'));
    expect(
      await screen.findByText('Too many requests. Wait a moment and try again.'),
    ).toBeVisible();
  });
});
