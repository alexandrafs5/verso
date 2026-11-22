import { render, screen } from '@testing-library/react';
import { messages } from '@verso/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { OnboardingLoading } from './OnboardingLoading';

describe('OnboardingLoading', () => {
  it('is a busy status region with screen reader text', () => {
    render(
      <NextIntlClientProvider locale="en" messages={messages.en}>
        <OnboardingLoading />
      </NextIntlClientProvider>,
    );
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveTextContent(messages.en.onboarding.loading);
  });
});
