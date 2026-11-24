import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, problem, renderWithProviders } from '../onboarding/test-utils';
import { sortSeriesWorks } from './series-utils';
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
        entry('ol:OL3W', 'Third', 3, 2003),
        entry('ol:OL0W', 'Unnumbered', null, null),
        entry('ol:OL1W', 'First', 1, 2001),
        entry('ol:OL2W', 'Second', 2, 2002),
      ],
});

function open(response: Response) {
  mockApi({ [`GET /api/v1/series/${ID}`]: () => response });
  renderWithProviders(<SeriesPage seriesId={ID} />);
}

beforeEach(() => nav.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('sortSeriesWorks', () => {
  const w = (title: string, position: number | null, firstPublishYear: number | null) => ({
    title,
    position,
    firstPublishYear,
  });

  it('sorts by position, unknown positions last, ties by title', () => {
    const sorted = sortSeriesWorks(
      [w('Z', null, null), w('B', 2, null), w('A', 2, null), w('C', 1.5, null), w('Y', null, null)],
      'en',
    ).map((work) => work.title);
    expect(sorted).toEqual(['C', 'A', 'B', 'Y', 'Z']);
  });

  it('sorts works with no position by first publication year, unknown years last', () => {
    const sorted = sortSeriesWorks(
      [
        w('Later', null, 2005),
        w('Undated', null, null),
        w('First', null, 1996),
        w('B', null, 2005),
      ],
      'en',
    ).map((work) => work.title);
    expect(sorted).toEqual(['First', 'B', 'Later', 'Undated']);
  });

  it('puts a numbered work before an unnumbered one, whatever the years', () => {
    const sorted = sortSeriesWorks([w('Old', null, 1900), w('Numbered', 3, 2020)], 'en').map(
      (work) => work.title,
    );
    expect(sorted).toEqual(['Numbered', 'Old']);
  });
});

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

  it('lists a series derived from Open Library: no numbers, publication order', async () => {
    const id = 'ol:A Song of Ice and Fire';
    mockApi({
      [`GET /api/v1/series/${encodeURIComponent(id)}`]: () =>
        json({
          id,
          name: 'A Song of Ice and Fire',
          works: [
            entry('ol:OL2W', 'A Clash of Kings', null, 1998),
            entry('ol:OL1W', 'A Game of Thrones', null, 1996),
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

  it('shows no read count, library control or status', async () => {
    open(json(series()));
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/You’ve read|You've read|Want to read|Add to library/)).toBeNull();
  });

  it('shows an empty state for a series with no works', async () => {
    open(json({ id: ID, name: 'The Saga', works: [] }));
    expect(await screen.findByText('No books found in this series')).toBeVisible();
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
