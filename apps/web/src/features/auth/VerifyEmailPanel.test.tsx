import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { clearPendingEmail, setPendingEmail } from './pending-email';
import { RESEND_UNTIL_KEY } from './use-resend-cooldown';
import { VerifyEmailPanel, type VerifyState } from './VerifyEmailPanel';

const mocks = vi.hoisted(() => ({ sendVerificationEmail: vi.fn() }));

vi.mock('@/lib/auth-client', () => ({
  authClient: { sendVerificationEmail: mocks.sendVerificationEmail },
}));

const t = messages.en.auth;

function setup(state: VerifyState) {
  const ui = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <VerifyEmailPanel state={state} />
    </NextIntlClientProvider>,
  );
  return ui;
}

beforeEach(() => {
  mocks.sendVerificationEmail.mockReset();
  clearPendingEmail();
  window.sessionStorage.clear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
});

describe('VerifyEmailPanel', () => {
  it('pending: shows the stored email and a Resend button', async () => {
    setPendingEmail('ana@example.com');
    setup('pending');

    expect(await screen.findByText(/ana@example\.com/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t.verifyEmail.pendingTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.verifyEmail.resend })).toBeEnabled();
    expect(screen.queryByLabelText(t.fields.email)).not.toBeInTheDocument();
  });

  it('pending without a stored email: shows an email field instead of an address', async () => {
    setup('pending');
    expect(await screen.findByLabelText(t.fields.email)).toBeInTheDocument();
    expect(screen.getByText(t.verifyEmail.pendingBodyNoEmail)).toBeInTheDocument();
  });

  it('success: shows the Sign in button and no Resend', () => {
    setup('success');
    expect(screen.getByRole('heading', { name: t.verifyEmail.successTitle })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.verifyEmail.successAction })).toHaveAttribute(
      'href',
      '/sign-in',
    );
    expect(screen.queryByRole('button', { name: t.verifyEmail.resend })).not.toBeInTheDocument();
  });

  it('expired: shows the expired copy with a Resend action', async () => {
    setPendingEmail('ana@example.com');
    setup('expired');
    expect(
      await screen.findByRole('heading', { name: t.verifyEmail.expiredTitle }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.verifyEmail.resend })).toBeInTheDocument();
  });

  it('resends with the verify-email callback, saves the email and starts the cooldown', async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    await ui.click(await screen.findByRole('button', { name: t.verifyEmail.resend }));

    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'ana@example.com',
      callbackURL: '/verify-email?status=success',
    });
    expect(await screen.findByText(t.verifyEmail.resent)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Resend in \d+s/ })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    expect(window.sessionStorage.getItem(RESEND_UNTIL_KEY)).not.toBeNull();
  });

  it('keeps focus on the Resend button through the request and the cooldown', async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    const button = await screen.findByRole('button', { name: t.verifyEmail.resend });
    await ui.click(button);

    await screen.findByText(t.verifyEmail.resent);
    expect(button).toHaveFocus();
  });

  it('does not send again while the cooldown runs', async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
    window.sessionStorage.setItem(RESEND_UNTIL_KEY, String(Date.now() + 30_000));
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    await ui.click(await screen.findByRole('button', { name: /Resend in \d+s/ }));

    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('asks for a valid email instead of sending when none is stored', async () => {
    const ui = setup('pending');
    await ui.click(await screen.findByRole('button', { name: t.verifyEmail.resend }));
    expect(await screen.findByText(t.validation.emailRequired)).toBeInTheDocument();

    await ui.type(screen.getByLabelText(t.fields.email), 'nope');
    await ui.click(screen.getByRole('button', { name: t.verifyEmail.resend }));
    expect(await screen.findByText(t.validation.emailInvalid)).toBeInTheDocument();
    expect(mocks.sendVerificationEmail).not.toHaveBeenCalled();
  });

  it('sends to the typed address when none is stored', async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: { status: true }, error: null });
    const ui = setup('pending');
    await ui.type(await screen.findByLabelText(t.fields.email), ' Ana@Example.com ');
    await ui.click(screen.getByRole('button', { name: t.verifyEmail.resend }));

    expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
      email: 'ana@example.com',
      callbackURL: '/verify-email?status=success',
    });
  });

  it('shows the rate limited message on 429 and allows another try', async () => {
    mocks.sendVerificationEmail.mockResolvedValue({ data: null, error: { status: 429 } });
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    const button = await screen.findByRole('button', { name: t.verifyEmail.resend });
    await ui.click(button);

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.rateLimited);
    expect(button).toBeEnabled();
    expect(button).toHaveFocus();
  });

  it('shows the network message when the request throws', async () => {
    mocks.sendVerificationEmail.mockRejectedValue(new TypeError('Failed to fetch'));
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    await ui.click(await screen.findByRole('button', { name: t.verifyEmail.resend }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.network);
  });

  it('tabs in order with a stored email: Resend, back link', async () => {
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    const order = [
      await screen.findByRole('button', { name: t.verifyEmail.resend }),
      screen.getByRole('link', { name: t.verifyEmail.backToSignIn }),
    ];
    for (const element of order) {
      await ui.tab();
      expect(element).toHaveFocus();
    }
  });

  it('tabs in order without a stored email: email, Resend, back link', async () => {
    const ui = setup('pending');
    const order = [
      await screen.findByLabelText(t.fields.email),
      screen.getByRole('button', { name: t.verifyEmail.resend }),
      screen.getByRole('link', { name: t.verifyEmail.backToSignIn }),
    ];
    for (const element of order) {
      await ui.tab();
      expect(element).toHaveFocus();
    }
  });

  it('tabs from the Resend button to the back link during the cooldown', async () => {
    window.sessionStorage.setItem(RESEND_UNTIL_KEY, String(Date.now() + 30_000));
    setPendingEmail('ana@example.com');
    const ui = setup('pending');
    const resend = await screen.findByRole('button', { name: /Resend in \d+s/ });
    await ui.tab();
    expect(resend).toHaveFocus();
    await ui.tab();
    expect(screen.getByRole('link', { name: t.verifyEmail.backToSignIn })).toHaveFocus();
  });
});
