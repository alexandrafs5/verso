import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { SignInForm } from './SignInForm';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
  session: { data: null as { user: { id: string } } | null },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/auth-client', () => ({
  signIn: { email: mocks.signInEmail, social: mocks.signInSocial },
  useSession: () => mocks.session,
}));

const t = messages.en.auth;

function setup(props: { oauthFailed?: boolean } = {}) {
  const ui = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <SignInForm {...props} />
    </NextIntlClientProvider>,
  );
  return {
    ui,
    email: screen.getByLabelText(t.fields.email),
    password: screen.getByLabelText(t.fields.password),
    submit: screen.getByRole('button', { name: t.signIn.submit }),
  };
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.signInEmail.mockReset();
  mocks.signInSocial.mockReset();
  mocks.session.data = null;
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
});

describe('SignInForm', () => {
  it('shows required errors and sends nothing when empty', async () => {
    const { ui, submit } = setup();
    await ui.click(submit);

    expect(await screen.findByText(t.validation.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(t.validation.passwordRequired)).toBeInTheDocument();
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it('shows an invalid email error', async () => {
    const { ui, email, password, submit } = setup();
    await ui.type(email, 'not-an-email');
    await ui.type(password, 'secret');
    await ui.click(submit);

    expect(await screen.findByText(t.validation.emailInvalid)).toBeInTheDocument();
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it('signs in with normalized values and goes to /home', async () => {
    mocks.signInEmail.mockResolvedValue({ data: {}, error: null });
    const { ui, email, password, submit } = setup();
    await ui.type(email, ' Ana@Example.com ');
    await ui.type(password, 'secret');
    await ui.click(submit);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/home'));
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'secret',
      callbackURL: '/home',
    });
  });

  it('shows one generic message for wrong credentials', async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' },
    });
    const { ui, email, password, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.type(password, 'wrong-password');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.invalidCredentials);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shows the unverified notice with the email', async () => {
    mocks.signInEmail.mockResolvedValue({
      data: null,
      error: { status: 403, code: 'EMAIL_NOT_VERIFIED' },
    });
    const { ui, email, password, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.type(password, 'secret');
    await ui.click(submit);

    const notice = await screen.findByRole('status');
    expect(notice).toHaveTextContent('ana@example.com');
    expect(notice).toHaveTextContent(t.signIn.unverifiedTitle);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the rate limited message on 429', async () => {
    mocks.signInEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    const { ui, email, password, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.type(password, 'secret');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.rateLimited);
  });

  it('shows the network message and keeps the typed values when the request throws', async () => {
    mocks.signInEmail.mockRejectedValue(new TypeError('Failed to fetch'));
    const { ui, email, password, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.type(password, 'secret');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.network);
    expect(email).toHaveValue('ana@example.com');
    expect(password).toHaveValue('secret');
    expect(submit).toBeEnabled();
  });

  it('disables the fields and shows a pending label while submitting', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.signInEmail.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { ui, email, password, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.type(password, 'secret');
    await ui.click(submit);

    const pending = await screen.findByRole('button', { name: t.signIn.submitting });
    expect(pending).toBeDisabled();
    expect(email).toBeDisabled();
    expect(password).toBeDisabled();

    finish({ data: {}, error: null });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  });

  it('starts Google sign-in with the home and error callbacks', async () => {
    mocks.signInSocial.mockResolvedValue({ data: {}, error: null });
    const { ui } = setup();
    await ui.click(screen.getByRole('button', { name: t.google }));

    expect(mocks.signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: '/home',
      errorCallbackURL: '/sign-in?error=oauth',
    });
  });

  it('shows the Google message when Google cannot start', async () => {
    mocks.signInSocial.mockResolvedValue({ data: null, error: { status: 404 } });
    const { ui } = setup();
    await ui.click(screen.getByRole('button', { name: t.google }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.google);
  });

  it('shows the Google message when returning from a failed OAuth round trip', () => {
    setup({ oauthFailed: true });
    expect(screen.getByRole('alert')).toHaveTextContent(t.errors.google);
  });

  it('links to forgot-password and create account', () => {
    setup();
    expect(screen.getByRole('link', { name: t.signIn.forgot })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: t.signIn.createLink })).toHaveAttribute(
      'href',
      '/sign-up',
    );
  });

  it('tabs in reading order: email, password, show, forgot, submit, Google, create account', async () => {
    const { ui, email, password, submit } = setup();
    const order = [
      email,
      password,
      screen.getByRole('button', { name: t.showPassword }),
      screen.getByRole('link', { name: t.signIn.forgot }),
      submit,
      screen.getByRole('button', { name: t.google }),
      screen.getByRole('link', { name: t.signIn.createLink }),
    ];
    for (const element of order) {
      await ui.tab();
      expect(element).toHaveFocus();
    }
  });

  it('sends one wake-up ping on mount', () => {
    setup();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith('/api/health', expect.anything());
  });

  it('redirects a signed-in user to /home', async () => {
    mocks.session.data = { user: { id: 'u1' } };
    setup();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/home'));
  });
});
