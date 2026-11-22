import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { ResetExpired, ResetPasswordForm } from './ResetPasswordForm';

const mocks = vi.hoisted(() => ({ replace: vi.fn(), resetPassword: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock('@/lib/auth-client', () => ({ authClient: { resetPassword: mocks.resetPassword } }));

const t = messages.en.auth;

function wrap(node: React.ReactNode) {
  return (
    <NextIntlClientProvider locale="en" messages={messages.en}>
      {node}
    </NextIntlClientProvider>
  );
}

function setup() {
  const ui = userEvent.setup();
  render(wrap(<ResetPasswordForm token="tok_123" />));
  return {
    ui,
    password: screen.getByLabelText(t.resetPassword.newPassword),
    confirm: screen.getByLabelText(t.resetPassword.confirmPassword),
    submit: screen.getByRole('button', { name: t.resetPassword.submit }),
  };
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.resetPassword.mockReset();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
});

describe('ResetPasswordForm', () => {
  it('shows required errors and sends nothing when empty', async () => {
    const { ui, submit } = setup();
    await ui.click(submit);

    expect(await screen.findByText(t.validation.passwordRequired)).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('asks for the confirmation when only the confirm field is empty', async () => {
    const { ui, password, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.click(submit);

    expect(await screen.findByText(t.validation.passwordRequired)).toBeInTheDocument();
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects a password shorter than 8 characters', async () => {
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, '1234567');
    await ui.type(confirm, '1234567');
    await ui.click(submit);

    expect(await screen.findByText(t.validation.passwordTooShort)).toBeInTheDocument();
    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords with a field error on confirm', async () => {
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.type(confirm, 'different123');
    await ui.click(submit);

    expect(await screen.findByText(t.validation.passwordMismatch)).toBeInTheDocument();
    expect(confirm).toHaveAttribute('aria-invalid', 'true');
    expect(mocks.resetPassword).not.toHaveBeenCalled();
  });

  it('resets with the token and redirects to sign-in with the success flag', async () => {
    mocks.resetPassword.mockResolvedValue({ data: { status: true }, error: null });
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.type(confirm, 'longenough1');
    await ui.click(submit);

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/sign-in?reset=success'));
    expect(mocks.resetPassword).toHaveBeenCalledWith({
      newPassword: 'longenough1',
      token: 'tok_123',
    });
  });

  it('switches to the expired state when the token is rejected', async () => {
    mocks.resetPassword.mockResolvedValue({
      data: null,
      error: { status: 400, code: 'INVALID_TOKEN' },
    });
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.type(confirm, 'longenough1');
    await ui.click(submit);

    expect(
      await screen.findByRole('heading', { name: t.resetPassword.expiredTitle }),
    ).toBeVisible();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shows the rate limited message on 429 and keeps the values', async () => {
    mocks.resetPassword.mockResolvedValue({ data: null, error: { status: 429 } });
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.type(confirm, 'longenough1');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.rateLimited);
    expect(password).toHaveValue('longenough1');
    expect(confirm).toHaveValue('longenough1');
    expect(submit).toBeEnabled();
  });

  it('shows the network message when the request throws', async () => {
    mocks.resetPassword.mockRejectedValue(new TypeError('Failed to fetch'));
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.type(confirm, 'longenough1');
    await ui.click(submit);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.network);
    expect(password).toHaveValue('longenough1');
  });

  it('disables the fields and shows a pending label while submitting', async () => {
    let finish: (value: unknown) => void = () => {};
    mocks.resetPassword.mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { ui, password, confirm, submit } = setup();
    await ui.type(password, 'longenough1');
    await ui.type(confirm, 'longenough1');
    await ui.click(submit);

    expect(await screen.findByRole('button', { name: t.resetPassword.submitting })).toBeDisabled();
    expect(password).toBeDisabled();

    finish({ data: {}, error: null });
    await waitFor(() => expect(mocks.replace).toHaveBeenCalled());
  });
});

describe('ResetExpired', () => {
  it('links to forgot-password', () => {
    render(wrap(<ResetExpired />));
    expect(screen.getByRole('link', { name: t.resetPassword.requestNew })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });
});
