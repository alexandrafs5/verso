import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@verso/i18n';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it, vi } from 'vitest';
import { OnboardingShell } from './OnboardingShell';

const t = messages.en.onboarding;

function shell(props: Partial<React.ComponentProps<typeof OnboardingShell>> = {}) {
  const onBack = vi.fn();
  const onSkip = vi.fn();
  const ui = (step: number) => (
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <OnboardingShell onBack={onBack} onSkip={onSkip} {...props} step={step}>
        <p>body</p>
      </OnboardingShell>
    </NextIntlClientProvider>
  );
  const view = render(ui(props.step ?? 3));
  return { ...view, ui, onBack, onSkip };
}

describe('OnboardingShell', () => {
  it('shows "Step N of 7" and a named progress bar with its value', () => {
    shell({ step: 3 });
    expect(screen.getByText('Step 3 of 7')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: t.progressLabel });
    expect(Number(bar.getAttribute('aria-valuenow'))).toBeCloseTo((3 / 7) * 100, 1);
  });

  it('renders the step title as the heading and moves focus to it', () => {
    shell({ step: 3 });
    const heading = screen.getByRole('heading', { level: 1, name: t.steps.rating.title });
    expect(heading).toHaveFocus();
  });

  it('moves focus to the new heading when the step changes', () => {
    const { rerender, ui } = shell({ step: 3 });
    screen.getByRole('button', { name: t.continue }).focus();
    rerender(ui(4));
    expect(screen.getByRole('heading', { level: 1, name: t.steps.progress.title })).toHaveFocus();
  });

  it('hides Back on step 1 and shows it on the others', () => {
    const { unmount } = shell({ step: 1 });
    expect(screen.queryByRole('button', { name: t.back })).not.toBeInTheDocument();
    unmount();
    shell({ step: 3 });
    expect(screen.getByRole('button', { name: t.back })).toBeInTheDocument();
  });

  it.each([1, 3, 4, 5])('has no Skip on required step %i', (step) => {
    shell({ step });
    expect(screen.queryByRole('button', { name: t.skip })).not.toBeInTheDocument();
  });

  it.each([2, 6, 7])('has Skip on optional step %i', (step) => {
    shell({ step });
    expect(screen.getByRole('button', { name: t.skip })).toBeInTheDocument();
  });

  it('calls onBack and onSkip', async () => {
    const ui = userEvent.setup();
    const { onBack, onSkip } = shell({ step: 2, showPrimary: false });
    await ui.click(screen.getByRole('button', { name: t.back }));
    await ui.click(screen.getByRole('button', { name: t.skip }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it('shows only Skip, no Continue, when showPrimary is false', () => {
    shell({ step: 7, showPrimary: false });
    expect(screen.queryByRole('button', { name: t.continue })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.skip })).toBeInTheDocument();
  });

  it('disables the controls and shows the pending label while saving', () => {
    shell({ step: 3, pending: true });
    expect(screen.getByRole('button', { name: t.saving })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.back })).toBeDisabled();
  });

  it('shows an inline problem message', () => {
    shell({ step: 3, error: t.saveFailed });
    expect(screen.getByRole('alert')).toHaveTextContent(t.saveFailed);
  });
});
