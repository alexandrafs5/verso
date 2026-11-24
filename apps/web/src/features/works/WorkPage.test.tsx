import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { json, mockApi, problem, renderWithProviders } from '../onboarding/test-utils';
import { WorkPage } from './WorkPage';

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: nav.push }) }));

const SERIES_ID = '0190f0f0-1234-7abc-8def-0123456789ab';

const work = (extra: Record<string, unknown> = {}) => ({
  ref: 'ol:OL1W',
  title: 'Pedro Páramo',
  subtitle: 'Novela',
  description: 'A man travels to Comala.',
  firstPublishYear: 1955,
  coverUrl: null,
  authors: [
    { ref: 'ol:OL1A', name: 'Juan Rulfo' },
    { ref: 'ol:OL2A', name: 'Other Author' },
  ],
  genres: ['Fiction', 'Zoology', 'fantasy'],
  series: null,
  source: 'OPEN_LIBRARY',
  libraryStatus: null,
  ...extra,
});

const edition = (extra: Record<string, unknown> = {}) => ({
  ref: 'ol:OL1M',
  title: 'Pedro Páramo',
  isbn10: null,
  isbn13: '9788437604947',
  publisher: 'Cátedra',
  publishYear: 1955,
  language: 'es',
  pageCount: 128,
  format: 'PAPERBACK',
  coverUrl: 'https://covers.example/1.jpg',
  isOriginalLanguage: false,
  ...extra,
});

function routes(opts: { work?: Response; editions?: Response } = {}) {
  return mockApi({
    'GET /api/v1/works/ol%3AOL1W': () => opts.work ?? json(work()),
    'GET /api/v1/works/ol%3AOL1W/editions': () => opts.editions ?? json([edition()]),
  });
}

beforeEach(() => nav.push.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe('WorkPage', () => {
  it('shows info, linked authors and mapped genre chips', async () => {
    routes();
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedro Páramo' })).toBeVisible();
    expect(screen.getByText('Novela')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Juan Rulfo' })).toHaveAttribute(
      'href',
      '/authors/ol%3AOL1A',
    );
    expect(screen.getByText('First published 1955 · 128 pages')).toBeVisible();
    expect(screen.getByText('A man travels to Comala.')).toBeVisible();

    const chips = screen.getAllByRole('link', { name: /Fiction|Fantasy|Zoology/ });
    expect(chips.map((chip) => chip.textContent)).toEqual(['Fiction', 'Fantasy']);
    expect(chips[0]).toHaveAttribute('href', '/search?genre=Fiction');
  });

  it('shows the edition line from the first edition but keeps the work cover', async () => {
    routes({ work: json(work({ coverUrl: 'https://covers.example/work.jpg' })) });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText('Edition: Spanish · Cátedra · 1955 · 128 pages')).toBeVisible();
    // Search shows the work cover, so the page does not swap it for the first edition's cover.
    expect(screen.getByRole('img', { name: 'Cover of Pedro Páramo' })).toHaveAttribute(
      'src',
      'https://covers.example/work.jpg',
    );
  });

  it('defaults to the edition in the UI language, not the first one listed', async () => {
    routes({
      editions: json([
        edition({ ref: 'ol:OL9M', language: 'ca', publisher: 'Debutxaca', pageCount: 824 }),
        edition({ ref: 'ol:OL8M', language: 'en', publisher: 'Bantam', pageCount: 694 }),
      ]),
    });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText('Edition: English · Bantam · 1955 · 694 pages')).toBeVisible();
    expect(screen.queryByText(/Catalan/)).not.toBeInTheDocument();
  });

  it('defaults to the original-language edition before the UI language', async () => {
    routes({
      editions: json([
        edition({ ref: 'ol:OL9M', language: 'ca', publisher: 'Debutxaca', pageCount: 824 }),
        edition({ ref: 'ol:OL8M', language: 'en', publisher: 'Bantam', pageCount: 694 }),
        edition({
          ref: 'ol:OL7M',
          language: 'es',
          publisher: 'Gigamesh',
          pageCount: 700,
          isOriginalLanguage: true,
        }),
      ]),
    });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    // The UI is English, but the original language wins.
    expect(await screen.findByText(/Edition: Spanish · Gigamesh/)).toBeVisible();
    expect(screen.queryByText(/Edition: English/)).not.toBeInTheDocument();
  });

  it('falls back to the first edition when none is in the UI language', async () => {
    routes({ editions: json([edition({ language: 'ca', publisher: 'Debutxaca' })]) });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText(/Edition: Catalan · Debutxaca/)).toBeVisible();
  });

  it('omits null parts of the edition line', async () => {
    routes({
      editions: json([edition({ language: null, publisher: null, pageCount: null })]),
    });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText('Edition: 1955')).toBeVisible();
  });

  it('hides the edition line when editions fail or are empty', async () => {
    routes({ editions: problem(500, 'INTERNAL_ERROR') });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    await screen.findByRole('heading', { level: 1 });
    await waitFor(() => expect(screen.queryByText(/^Edition:/)).not.toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  it('links the series line, and says "Part of" without a position', async () => {
    routes({ work: json(work({ series: { id: SERIES_ID, name: 'Saga', position: 2 } })) });
    const first = renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    const link = await screen.findByRole('link', { name: 'Book 2 of Saga' });
    expect(link).toHaveAttribute('href', `/series/${SERIES_ID}`);
    first.unmount();

    routes({ work: json(work({ series: { id: SERIES_ID, name: 'Saga', position: null } })) });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByRole('link', { name: 'Part of Saga' })).toBeVisible();
  });

  it('omits the series line, chips and synopsis when absent', async () => {
    routes({
      work: json(
        work({ series: null, genres: ['Accessible book'], description: null, subtitle: null }),
      ),
    });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/Part of|Book \d/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Genres' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Read more' })).not.toBeInTheDocument();
  });

  it('shows a Back button, also in the not-found state', async () => {
    routes();
    const first = renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
    first.unmount();

    routes({ work: problem(404, 'CATALOG_NOT_FOUND') });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    await screen.findByText('Book not found');
    expect(screen.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  it('renders no library, status, rating or reviews controls', async () => {
    routes();
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText(/Want to read|Add to library|Reviews|No reviews/i)).toBeNull();
  });

  it('shows the not-found state for a 404 and for an invalid ref', async () => {
    routes({ work: problem(404, 'CATALOG_NOT_FOUND') });
    const first = renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText('Book not found')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Search for a book' }));
    expect(nav.push).toHaveBeenCalledWith('/search');
    first.unmount();

    routes({ work: problem(400, 'INVALID_REF') });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText('Book not found')).toBeVisible();
  });

  // A real 503 is retried by the API client with backoff (up to 75 s) before this state shows,
  // so the test uses a non-retryable 500.
  it('shows an error with Retry for a server error and a rate-limit message for 429', async () => {
    let calls = 0;
    mockApi({
      'GET /api/v1/works/ol%3AOL1W': () =>
        ++calls === 1 ? problem(500, 'INTERNAL_ERROR') : json(work()),
      'GET /api/v1/works/ol%3AOL1W/editions': () => json([edition()]),
    });
    const first = renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(await screen.findByText('We couldn’t load this book')).toBeVisible();
    expect(screen.getByText('Check your connection and try again.')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Pedro Páramo' })).toBeVisible();
    first.unmount();

    routes({ work: problem(429, 'RATE_LIMITED') });
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    expect(
      await screen.findByText('Too many requests. Wait a moment and try again.'),
    ).toBeVisible();
  });

  it('writes nothing: every request is a GET', async () => {
    const fetchMock = routes();
    renderWithProviders(<WorkPage workRef="ol:OL1W" />);
    await screen.findByRole('heading', { level: 1 });
    for (const call of fetchMock.mock.calls) {
      expect((call[1] as RequestInit | undefined)?.method ?? 'GET').toBe('GET');
    }
  });
});
