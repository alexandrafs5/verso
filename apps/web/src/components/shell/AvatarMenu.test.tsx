import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { messages } from '@verso/i18n';
import { AvatarMenu } from './AvatarMenu';
import type { ShellUser } from './types';

const base: ShellUser = {
  name: 'Ada Lovelace',
  username: 'ada',
  avatarUrl: null,
  role: 'USER',
};

function setup(user: ShellUser = base) {
  const onSignOut = vi.fn();
  const ui = userEvent.setup();
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <AvatarMenu user={user} onSignOut={onSignOut} />
    </NextIntlClientProvider>,
  );
  return { onSignOut, ui };
}

describe('AvatarMenu', () => {
  it('shows initials when there is no avatar image', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Account menu' })).toHaveTextContent('AL');
  });

  it('opens with the keyboard and lists Profile, Settings, Sign out (no Admin for USER)', async () => {
    const { ui } = setup();
    screen.getByRole('button', { name: 'Account menu' }).focus();
    await ui.keyboard('{Enter}');
    expect(await screen.findByRole('menuitem', { name: 'Profile' })).toHaveAttribute(
      'href',
      '/u/ada',
    );
    expect(screen.getByRole('menuitem', { name: 'Settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Admin' })).not.toBeInTheDocument();
  });

  it('shows Admin only for the ADMIN role', async () => {
    const { ui } = setup({ ...base, role: 'ADMIN' });
    await ui.click(screen.getByRole('button', { name: 'Account menu' }));
    expect(await screen.findByRole('menuitem', { name: 'Admin' })).toBeInTheDocument();
  });

  it('closes with Escape', async () => {
    const { ui } = setup();
    await ui.click(screen.getByRole('button', { name: 'Account menu' }));
    await screen.findByRole('menu');
    await ui.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('Sign out calls onSignOut', async () => {
    const { ui, onSignOut } = setup();
    await ui.click(screen.getByRole('button', { name: 'Account menu' }));
    await ui.click(await screen.findByRole('menuitem', { name: 'Sign out' }));
    expect(onSignOut).toHaveBeenCalledTimes(1);
  });
});
