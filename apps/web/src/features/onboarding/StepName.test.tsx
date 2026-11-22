import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepName } from './StepName';
import { baseMe, bodyOf, json, mockApi, problem, renderWithProviders, t } from './test-utils';

const AVAILABILITY = 'GET /api/v1/usernames/*';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const usernameField = () => screen.getByLabelText(t.name.usernameLabel);
const nameField = () => screen.getByLabelText(t.name.nameLabel);

describe('StepName (step 1)', () => {
  it('prefills the name and a suggested available username', async () => {
    mockApi({ [AVAILABILITY]: () => json({ available: true }) });
    renderWithProviders(<StepName me={baseMe} onNext={vi.fn()} />);

    expect(nameField()).toHaveValue('Ana Garcia');
    await waitFor(() => expect(usernameField()).toHaveValue('ana_garcia'));
  });

  it('tries the next candidate when the first is taken', async () => {
    mockApi({
      [AVAILABILITY]: (_init, url) =>
        json(
          url.includes('/ana_garcia/')
            ? { available: false, reason: 'TAKEN' }
            : { available: true },
        ),
    });
    renderWithProviders(<StepName me={baseMe} onNext={vi.fn()} />);

    await waitFor(() => expect(usernameField()).toHaveValue('ana_garcia2'));
  });

  it('does not overwrite what the person already typed', async () => {
    const ui = userEvent.setup();
    let release: (response: Response) => void = () => undefined;
    mockApi({
      [AVAILABILITY]: (_init, url) =>
        url.includes('/ana_garcia/')
          ? new Promise<Response>((resolve) => (release = resolve))
          : json({ available: true }),
    });
    renderWithProviders(<StepName me={baseMe} onNext={vi.fn()} />);

    await ui.type(usernameField(), 'mine_01');
    release(json({ available: true }));
    await waitFor(() =>
      expect(screen.getByText(t.name.availability.available)).toBeInTheDocument(),
    );
    expect(usernameField()).toHaveValue('mine_01');
  });

  it('does not suggest anything when the account already has a username', async () => {
    const fetchMock = mockApi({ [AVAILABILITY]: () => json({ available: true }) });
    renderWithProviders(<StepName me={{ ...baseMe, username: 'ana' }} onNext={vi.fn()} />);

    expect(usernameField()).toHaveValue('ana');
    expect(screen.getByText(t.name.availability.available)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['TAKEN', t.name.availability.TAKEN],
    ['RESERVED', t.name.availability.RESERVED],
    ['TOO_SHORT', t.name.availability.TOO_SHORT],
    ['INVALID_CHARACTERS', t.name.availability.INVALID_CHARACTERS],
  ])('shows the %s reason from the live check', async (reason, text) => {
    const ui = userEvent.setup();
    mockApi({
      [AVAILABILITY]: (_init, url) =>
        url.includes('/typed_name/')
          ? json({ available: false, reason })
          : json({ available: true }),
    });
    renderWithProviders(<StepName me={{ ...baseMe, username: 'ana' }} onNext={vi.fn()} />);

    await ui.clear(usernameField());
    await ui.type(usernameField(), 'typed_name');
    expect(await screen.findByText(text)).toBeInTheDocument();
    expect(usernameField()).toHaveAttribute('aria-invalid', 'true');
  });

  it('shows a neutral message when the check fails and still lets the person continue', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    mockApi({
      [AVAILABILITY]: () => problem(500, 'INTERNAL_ERROR'),
      'PATCH /api/v1/me/settings': () => json(baseMe),
      'PATCH /api/v1/me': () => json({ ...baseMe, username: 'free_name' }),
    });
    renderWithProviders(<StepName me={baseMe} onNext={onNext} />);

    await ui.type(usernameField(), 'free_name');
    expect(await screen.findByText(t.name.availability.checkFailed)).toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: t.continue }));
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
  });

  it('saves the time zone, the UI locale, the name and the username, then moves on', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(
      () =>
        ({
          resolvedOptions: () => ({ timeZone: 'Europe/Madrid' }),
        }) as unknown as Intl.DateTimeFormat,
    );
    let settingsBody: unknown;
    let meBody: unknown;
    mockApi({
      [AVAILABILITY]: () => json({ available: true }),
      'PATCH /api/v1/me/settings': (init) => {
        settingsBody = bodyOf(init);
        return json(baseMe);
      },
      'PATCH /api/v1/me': (init) => {
        meBody = bodyOf(init);
        return json({ ...baseMe, username: 'ana_garcia' });
      },
    });
    renderWithProviders(<StepName me={baseMe} onNext={onNext} />);

    await waitFor(() => expect(usernameField()).toHaveValue('ana_garcia'));
    await ui.click(screen.getByRole('button', { name: t.continue }));

    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(settingsBody).toEqual({ locale: 'en', timeZone: 'Europe/Madrid' });
    expect(meBody).toEqual({ name: 'Ana Garcia', username: 'ana_garcia' });
  });

  it('shows required errors and sends nothing when the fields are empty', async () => {
    const ui = userEvent.setup();
    const fetchMock = mockApi({
      [AVAILABILITY]: () => json({ available: false, reason: 'TAKEN' }),
    });
    renderWithProviders(<StepName me={{ ...baseMe, name: '' }} onNext={vi.fn()} />);

    await ui.click(screen.getByRole('button', { name: t.continue }));
    expect(await screen.findByText(t.name.errors.nameRequired)).toBeInTheDocument();
    expect(screen.getAllByText(t.name.errors.usernameRequired).length).toBeGreaterThan(0);
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(false);
  });

  it('shows the taken reason when the server rejects the save with 409', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    mockApi({
      [AVAILABILITY]: () => json({ available: true }),
      'PATCH /api/v1/me/settings': () => json(baseMe),
      'PATCH /api/v1/me': () => problem(409, 'USERNAME_TAKEN'),
    });
    renderWithProviders(<StepName me={baseMe} onNext={onNext} />);

    await waitFor(() => expect(usernameField()).toHaveValue('ana_garcia'));
    await ui.click(screen.getByRole('button', { name: t.continue }));

    expect(await screen.findByText(t.name.availability.TAKEN)).toBeInTheDocument();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows an inline problem message with retry when the save fails', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    let fail = true;
    mockApi({
      [AVAILABILITY]: () => json({ available: true }),
      'PATCH /api/v1/me/settings': () => (fail ? problem(500, 'INTERNAL_ERROR') : json(baseMe)),
      'PATCH /api/v1/me': () => json({ ...baseMe, username: 'ana_garcia' }),
    });
    renderWithProviders(<StepName me={baseMe} onNext={onNext} />);

    await waitFor(() => expect(usernameField()).toHaveValue('ana_garcia'));
    await ui.click(screen.getByRole('button', { name: t.continue }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.saveFailed);
    expect(onNext).not.toHaveBeenCalled();

    fail = false;
    await ui.click(screen.getByRole('button', { name: t.continue }));
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
  });
});
