import { act, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { messages } from '@verso/i18n';
import { markWaking } from '@/lib/waking-state';
import { WakingBanner } from './WakingBanner';

function setup() {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <WakingBanner />
    </NextIntlClientProvider>,
  );
}

describe('WakingBanner', () => {
  it('renders nothing when idle', () => {
    setup();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('shows the message with role=status while waking, then hides', () => {
    setup();
    let release = () => {};
    act(() => {
      release = markWaking();
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'Waking up the server. This can take up to a minute.',
    );
    act(() => release());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
