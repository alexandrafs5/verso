import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '@/features/onboarding/test-utils';
import { BackButton } from './BackButton';

const nav = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => nav }));

beforeEach(() => {
  nav.back.mockReset();
  nav.push.mockReset();
});
afterEach(() => vi.restoreAllMocks());

describe('BackButton', () => {
  it('goes back in the history when there is one', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(3);
    renderWithProviders(<BackButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(nav.push).not.toHaveBeenCalled();
  });

  it('goes to the fallback when this page is the first history entry', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);
    renderWithProviders(<BackButton />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.push).toHaveBeenCalledWith('/home');
    expect(nav.back).not.toHaveBeenCalled();
  });

  it('uses a custom fallback', async () => {
    vi.spyOn(window.history, 'length', 'get').mockReturnValue(1);
    renderWithProviders(<BackButton fallbackHref="/search" />);
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(nav.push).toHaveBeenCalledWith('/search');
  });
});
