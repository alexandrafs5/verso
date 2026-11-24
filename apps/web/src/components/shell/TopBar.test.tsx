import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { messages } from '@verso/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { TopBar } from './TopBar';
import type { ShellUser } from './types';

vi.mock('next/navigation', () => ({
  usePathname: () => '/home',
  useRouter: () => ({ push: vi.fn() }),
}));

const user: ShellUser = { name: 'Ada Lovelace', username: 'ada', avatarUrl: null, role: 'USER' };

function setup() {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <QueryClientProvider client={new QueryClient()}>
        <TopBar user={user} onSignOut={vi.fn()} />
      </QueryClientProvider>
    </NextIntlClientProvider>,
  );
}

describe('TopBar search', () => {
  it('keeps the icon link to /search for widths below 768px only', () => {
    setup();
    const link = screen.getByRole('link', { name: 'Search' });
    expect(link).toHaveAttribute('href', '/search');
    expect(link).toHaveClass('md:hidden');
  });

  it('shows the search field with dropdown from 768px only', () => {
    setup();
    const field = screen.getByRole('combobox', { name: 'Search books' });
    expect(field.parentElement).toHaveClass('hidden', 'md:block');
  });
});
