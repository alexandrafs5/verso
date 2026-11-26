import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { type Locale, messages } from '@verso/i18n';
import type { LibraryStatus } from '@verso/shared';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bodyOf, json, mockApi, problem } from '../onboarding/test-utils';
import { LibraryControl } from './LibraryControl';

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

const UUID = '0190f0f0-1234-7abc-8def-0123456789ab';

const status = (extra: Partial<LibraryStatus> = {}): LibraryStatus => ({
  userBookId: UUID,
  status: 'READ',
  readCount: 1,
  editionRef: 'ol:OL1M',
  ...extra,
});

const added = (extra: Record<string, unknown> = {}) =>
  json({ ...status({ status: 'WANT_TO_READ', readCount: 0 }), workRef: UUID, ...extra }, 201);

function renderControl(
  libraryStatus: LibraryStatus | null = null,
  { locale = 'en', editionRef }: { locale?: Locale; editionRef?: string } = {},
) {
  const queryClient = new QueryClient();
  return render(
    <NextIntlClientProvider locale={locale} messages={messages[locale]}>
      <QueryClientProvider client={queryClient}>
        <LibraryControl
          workRef="ol:OL1W"
          title="Pedro Páramo"
          libraryStatus={libraryStatus}
          editionRef={editionRef}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

const mainButton = () => screen.getByRole('button', { name: 'Want to read: Pedro Páramo' });
const chevron = () => screen.getByRole('button', { name: 'Choose a status for Pedro Páramo' });

beforeEach(() => {
  toast.success.mockReset();
  toast.error.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('LibraryControl', () => {
  it('adds as Want to read from the main button, with a success toast', async () => {
    const fetchMock = mockApi({ 'POST /api/v1/library': () => added() });
    renderControl();
    expect(mainButton()).toHaveTextContent('Want to read');

    await userEvent.click(mainButton());

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Book added to Want to read'));
    expect(bodyOf(fetchMock.mock.calls[0]?.[1])).toEqual({
      workRef: 'ol:OL1W',
      status: 'WANT_TO_READ',
    });
  });

  it('adds with another status and the given edition, using the keyboard only', async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ 'POST /api/v1/library': () => added({ status: 'READING' }) });
    renderControl(null, { editionRef: 'ol:OL7M' });

    await user.tab();
    await user.tab();
    expect(chevron()).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Want to read',
      'Reading',
      'Read',
      'Abandoned',
    ]);
    await user.keyboard('{ArrowDown}{Enter}');

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Book added to Reading'));
    expect(bodyOf(fetchMock.mock.calls[0]?.[1])).toEqual({
      workRef: 'ol:OL1W',
      editionRef: 'ol:OL7M',
      status: 'READING',
    });
  });

  it('disables both parts while the add is pending', async () => {
    mockApi({ 'POST /api/v1/library': () => new Promise<Response>(() => {}) });
    renderControl();

    await userEvent.click(mainButton());

    await waitFor(() => expect(mainButton()).toBeDisabled());
    expect(chevron()).toBeDisabled();
    expect(mainButton().parentElement).toHaveAttribute('aria-busy', 'true');
  });

  it('shows a saved book as a disabled status', () => {
    renderControl(status());
    expect(screen.getByRole('button', { name: 'Read' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Want to read/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/×/)).not.toBeInTheDocument();
  });

  it('shows how many times a book was read from 2', () => {
    renderControl(status({ status: 'READING', readCount: 2 }));
    expect(screen.getByText('×2')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.getByText('Read 2 times')).toBeInTheDocument();
  });

  const FAILURES = [
    [409, 'BOOK_ALREADY_IN_LIBRARY', 'alreadyInLibrary'],
    [422, 'NO_EDITION_AVAILABLE', 'noEdition'],
    [422, 'EDITION_NOT_IN_WORK', 'editionNotInWork'],
    [404, 'CATALOG_NOT_FOUND', 'notFound'],
    [503, 'CATALOG_UNAVAILABLE', 'unavailable'],
    [500, 'INTERNAL_ERROR', 'generic'],
  ] as const;

  describe.each(['en', 'es'] as const)('failures in %s', (locale) => {
    const label = `${messages[locale].status.WANT_TO_READ}: Pedro Páramo`;

    it.each(FAILURES)('%i %s shows its toast and re-enables', async (code, error, key) => {
      const fetchMock = mockApi({ 'POST /api/v1/library': () => problem(code, error) });
      renderControl(null, { locale });
      const button = screen.getByRole('button', { name: label });

      await userEvent.click(button);

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(messages[locale].library.errors[key]),
      );
      await waitFor(() => expect(button).toBeEnabled());
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('uses the common rate limit message', async () => {
      mockApi({ 'POST /api/v1/library': () => problem(429, 'RATE_LIMITED') });
      renderControl(null, { locale });

      await userEvent.click(screen.getByRole('button', { name: label }));

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(messages[locale].common.rateLimited),
      );
    });
  });
});
