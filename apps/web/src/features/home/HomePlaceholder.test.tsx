import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { HomePlaceholder } from './HomePlaceholder';

type SessionState = {
  data: { user: Record<string, unknown> } | null;
  isPending: boolean;
  error: unknown;
  refetch: () => Promise<void>;
};

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signOut: vi.fn(),
  assign: vi.fn(),
  refetch: vi.fn(),
  session: {} as SessionState,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: vi.fn() }),
  usePathname: () => '/home',
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut: mocks.signOut },
  useSession: () => mocks.session,
}));

function setSession(state: Partial<SessionState>) {
  mocks.session = {
    data: null,
    isPending: false,
    error: null,
    refetch: mocks.refetch,
    ...state,
  };
}

function setup() {
  const ui = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={new QueryClient()}>
        <HomePlaceholder />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
  return { ui };
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.signOut.mockReset().mockResolvedValue({});
  mocks.assign.mockReset();
  vi.stubGlobal('location', { assign: mocks.assign });
  mocks.refetch.mockReset().mockResolvedValue(undefined);
});

describe('HomePlaceholder', () => {
  it('shows a skeleton while the session loads and does not redirect', () => {
    setSession({ isPending: true });
    setup();
    expect(screen.getByRole('status')).toHaveTextContent(messages.en.home.checkingSession);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('redirects to /sign-in when there is no session', async () => {
    setSession({ data: null });
    setup();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('shows an error state with retry when the session check fails', async () => {
    setSession({ error: { status: 0 } });
    const { ui } = setup();

    expect(screen.getByRole('alert')).toHaveTextContent(messages.en.home.errorTitle);
    expect(mocks.replace).not.toHaveBeenCalled();

    await ui.click(screen.getByRole('button', { name: messages.en.common.retry }));
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });

  it('renders the shell with the empty state for a signed-in user', () => {
    setSession({
      data: { user: { name: 'Ada Lovelace', username: null, image: null, role: 'USER' } },
    });
    setup();

    expect(
      screen.getByRole('heading', { level: 1, name: messages.en.home.title }),
    ).toBeInTheDocument();
    expect(screen.getByText(messages.en.home.emptyTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('AL');
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('signs out and goes back to /sign-in', async () => {
    setSession({
      data: { user: { name: 'Ada Lovelace', username: 'ada', image: null, role: 'USER' } },
    });
    const { ui } = setup();

    await ui.click(screen.getByRole('button', { name: 'Account menu' }));
    await ui.click(await screen.findByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(mocks.assign).toHaveBeenCalledWith('/sign-in'));
    expect(mocks.signOut).toHaveBeenCalledTimes(1);
    // A full page load, not a soft navigation: stale client state must not survive.
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});
