import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { clearPendingEmail, getPendingEmail } from './pending-email';
import { SignUpForm } from './SignUpForm';

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
  session: { data: null as { user: { id: string } } | null },
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/auth-client', () => ({
  signUp: { email: mocks.signUpEmail },
  signIn: { social: mocks.signInSocial },
  useSession: () => mocks.session,
}));

const t = messages.en.auth;

function setup() {
  const ui = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <SignUpForm />
    </NextIntlClientProvider>,
  );
  return {
    ui,
    name: screen.getByLabelText(t.fields.name),
    email: screen.getByLabelText(t.fields.email),
    password: screen.getByLabelText(t.fields.password),
    submit: screen.getByRole('button', { name: t.signUp.submit }),
  };
}

async function fill(
  s: ReturnType<typeof setup>,
  values: { name?: string; email?: string; password?: string } = {},
) {
  await s.ui.type(s.name, values.name ?? 'Ana');
  await s.ui.type(s.email, values.email ?? 'ana@example.com');
  await s.ui.type(s.password, values.password ?? 'longenough1');
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.signUpEmail.mockReset();
  mocks.signInSocial.mockReset();
  mocks.session.data = null;
  clearPendingEmail();
});

describe('SignUpForm', () => {
  it('shows required errors and sends nothing when empty', async () => {
    const { ui, submit } = setup();
    await ui.click(submit);

    expect(await screen.findByText(t.validation.nameRequired)).toBeInTheDocument();
    expect(screen.getByText(t.validation.emailRequired)).toBeInTheDocument();
    expect(screen.getByText(t.validation.passwordRequired)).toBeInTheDocument();
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it('submits with Enter from the password field', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
    const s = setup();
    await s.ui.type(s.name, 'Ana');
    await s.ui.type(s.email, 'ana@example.com');
    await s.ui.type(s.password, 'longenough1{Enter}');

    await waitFor(() => expect(mocks.signUpEmail).toHaveBeenCalledTimes(1));
  });

  it('rejects a password shorter than 8 characters before any request', async () => {
    const s = setup();
    await fill(s, { password: '1234567' });
    await s.ui.click(s.submit);

    expect(await screen.findByText(t.validation.passwordTooShort)).toBeInTheDocument();
    expect(s.password).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.signUpEmail).not.toHaveBeenCalled();
  });

  it('never disables submit because of password strength', async () => {
    const s = setup();
    await s.ui.type(s.password, 'a');
    expect(screen.getByRole('status')).toHaveTextContent(t.strength.weak);
    expect(s.submit).toBeEnabled();
  });

  it('calls signUp.email, saves the email and redirects to /verify-email', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: {}, error: null });
    const s = setup();
    await fill(s, { email: ' Ana@Example.com ' });
    await s.ui.click(s.submit);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/verify-email'));
    expect(getPendingEmail()).toBe('ana@example.com');
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      name: 'Ana',
      email: 'ana@example.com',
      password: 'longenough1',
      callbackURL: '/verify-email?status=success',
    });
  });

  it('does not save the email or redirect when sign-up fails', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    const s = setup();
    await fill(s);
    await s.ui.click(s.submit);

    await screen.findByRole('alert');
    expect(getPendingEmail()).toBeNull();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shows "email in use" with a link to sign in', async () => {
    mocks.signUpEmail.mockResolvedValue({
      data: null,
      error: { status: 422, code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' },
    });
    const s = setup();
    await fill(s);
    await s.ui.click(s.submit);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.errors.emailInUse);
    expect(alert.querySelector('a')).toHaveAttribute('href', '/sign-in');
  });

  it('shows the rate limited message on 429 and keeps the values', async () => {
    mocks.signUpEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    const s = setup();
    await fill(s);
    await s.ui.click(s.submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.rateLimited);
    expect(s.email).toHaveValue('ana@example.com');
  });

  it('shows the network message and keeps the typed values when the request throws', async () => {
    mocks.signUpEmail.mockRejectedValue(new TypeError('Failed to fetch'));
    const s = setup();
    await fill(s);
    await s.ui.click(s.submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.network);
    expect(s.name).toHaveValue('Ana');
    expect(s.password).toHaveValue('longenough1');
    expect(s.submit).toBeEnabled();
  });

  it('disables the fields and shows a pending label while submitting', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.signUpEmail.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const s = setup();
    await fill(s);
    await s.ui.click(s.submit);

    expect(await screen.findByRole('button', { name: t.signUp.submitting })).toBeDisabled();
    expect(s.email).toBeDisabled();

    finish({ data: {}, error: null });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/verify-email'));
  });

  it('starts Google sign-in', async () => {
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

  it('tabs in reading order: name, email, password, show, submit, Google, sign in', async () => {
    const s = setup();
    const order = [
      s.name,
      s.email,
      s.password,
      screen.getByRole('button', { name: t.showPassword }),
      s.submit,
      screen.getByRole('button', { name: t.google }),
      screen.getByRole('link', { name: t.signUp.signInLink }),
    ];
    for (const element of order) {
      await s.ui.tab();
      expect(element).toHaveFocus();
    }
  });

  it('links to sign in', () => {
    setup();
    expect(screen.getByRole('link', { name: t.signUp.signInLink })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('redirects a signed-in user to /home', async () => {
    mocks.session.data = { user: { id: 'u1' } };
    setup();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/home'));
  });
});
