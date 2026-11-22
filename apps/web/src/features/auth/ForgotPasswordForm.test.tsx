import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { ForgotPasswordForm } from './ForgotPasswordForm';

const mocks = vi.hoisted(() => ({ requestPasswordReset: vi.fn() }));

vi.mock('@/lib/auth-client', () => ({
  authClient: { requestPasswordReset: mocks.requestPasswordReset },
}));

const t = messages.en.auth;

function setup() {
  const ui = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <ForgotPasswordForm />
    </NextIntlClientProvider>,
  );
  return {
    ui,
    email: screen.getByLabelText(t.fields.email),
    submit: screen.getByRole('button', { name: t.forgotPassword.submit }),
  };
}

beforeEach(() => {
  mocks.requestPasswordReset.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
});

describe('ForgotPasswordForm', () => {
  it('shows an error and sends nothing for an empty or invalid email', async () => {
    const { ui, email, submit } = setup();
    await ui.click(submit);
    expect(await screen.findByText(t.validation.emailRequired)).toBeInTheDocument();

    await ui.type(email, 'nope');
    await ui.click(submit);
    expect(await screen.findByText(t.validation.emailInvalid)).toBeInTheDocument();
    expect(mocks.requestPasswordReset).not.toHaveBeenCalled();
  });

  it('requests a reset with the normalized email and shows the neutral message', async () => {
    mocks.requestPasswordReset.mockResolvedValue({ data: { status: true }, error: null });
    const { ui, email, submit } = setup();
    await ui.type(email, ' Ana@Example.com ');
    await ui.click(submit);

    expect(await screen.findByRole('heading', { name: t.forgotPassword.sentTitle })).toHaveFocus();
    expect(screen.getByText(t.forgotPassword.sentBody)).toBeInTheDocument();
    expect(mocks.requestPasswordReset).toHaveBeenCalledWith({
      email: 'ana@example.com',
      redirectTo: '/reset-password',
    });
    expect(screen.getByRole('link', { name: t.forgotPassword.backToSignIn })).toHaveAttribute(
      'href',
      '/sign-in',
    );
  });

  it('shows the same neutral message when the account is not found', async () => {
    mocks.requestPasswordReset.mockResolvedValue({ data: null, error: { status: 404 } });
    const { ui, email, submit } = setup();
    await ui.type(email, 'ghost@example.com');
    await ui.click(submit);

    expect(await screen.findByText(t.forgotPassword.sentBody)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the rate limited message on 429 and keeps the email', async () => {
    mocks.requestPasswordReset.mockResolvedValue({ data: null, error: { status: 429 } });
    const { ui, email, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.rateLimited);
    expect(email).toHaveValue('ana@example.com');
    expect(submit).toBeEnabled();
  });

  it('shows the network message and keeps the email when the request throws', async () => {
    mocks.requestPasswordReset.mockRejectedValue(new TypeError('Failed to fetch'));
    const { ui, email, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.network);
    expect(email).toHaveValue('ana@example.com');
  });

  it('disables the field and shows a pending label while submitting', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.requestPasswordReset.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { ui, email, submit } = setup();
    await ui.type(email, 'ana@example.com');
    await ui.click(submit);

    expect(await screen.findByRole('button', { name: t.forgotPassword.submitting })).toBeDisabled();
    expect(email).toBeDisabled();

    finish({ data: {}, error: null });
    await screen.findByText(t.forgotPassword.sentBody);
  });
});
