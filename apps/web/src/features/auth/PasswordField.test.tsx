import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { messages } from '@verso/i18n';
import { PasswordField } from './PasswordField';

function setup(props: Partial<React.ComponentProps<typeof PasswordField>> = {}) {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <label htmlFor="pw">Password</label>
      <PasswordField id="pw" {...props} />
    </NextIntlClientProvider>,
  );
  return { ui: userEvent.setup(), input: screen.getByLabelText('Password') };
}

describe('PasswordField', () => {
  it('hides the password by default', () => {
    const { input } = setup();
    expect(input).toHaveAttribute('type', 'password');
  });

  it('toggles the input type and the accessible name', async () => {
    const { ui, input } = setup();

    await ui.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveAttribute('type', 'text');

    await ui.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('does not submit a form when toggled', async () => {
    const { ui } = setup();
    expect(screen.getByRole('button', { name: 'Show password' })).toHaveAttribute('type', 'button');
    await ui.click(screen.getByRole('button', { name: 'Show password' }));
  });

  it('keeps the typed value when toggled', async () => {
    const { ui, input } = setup();
    await ui.type(input, 'secret123');
    await ui.click(screen.getByRole('button', { name: 'Show password' }));
    expect(input).toHaveValue('secret123');
  });

  it('disables the toggle when the input is disabled', () => {
    setup({ disabled: true });
    expect(screen.getByRole('button', { name: 'Show password' })).toBeDisabled();
  });
});
