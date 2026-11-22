import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingFlow } from './OnboardingFlow';
import { RequireOnboarded } from './RequireOnboarded';
import { baseMe, json, mockApi, problem, renderWithProviders, t } from './test-utils';

const mocks = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, push: mocks.push }),
}));

const done = { ...baseMe, username: 'ana', onboardingCompletedAt: '2026-11-22T10:00:00.000Z' };

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.push.mockReset();
  vi.unstubAllGlobals();
});

describe('RequireOnboarded (app gate)', () => {
  it('shows a loading state, not the app, while the account loads', () => {
    mockApi({ 'GET /api/v1/me': () => new Promise<Response>(() => undefined) });
    renderWithProviders(
      <RequireOnboarded>
        <p>app</p>
      </RequireOnboarded>,
    );
    expect(screen.getByRole('status')).toHaveTextContent(t.loading);
    expect(screen.queryByText('app')).not.toBeInTheDocument();
  });

  it('redirects an account without a username to step 1', async () => {
    mockApi({ 'GET /api/v1/me': () => json(baseMe) });
    renderWithProviders(
      <RequireOnboarded>
        <p>app</p>
      </RequireOnboarded>,
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/onboarding/1'));
    expect(screen.queryByText('app')).not.toBeInTheDocument();
  });

  it('redirects an account with a username but unfinished onboarding to step 2', async () => {
    mockApi({ 'GET /api/v1/me': () => json({ ...baseMe, username: 'ana' }) });
    renderWithProviders(
      <RequireOnboarded>
        <p>app</p>
      </RequireOnboarded>,
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/onboarding/2'));
  });

  it('renders the app for a finished account and does not redirect', async () => {
    mockApi({ 'GET /api/v1/me': () => json(done) });
    renderWithProviders(
      <RequireOnboarded>
        <p>app</p>
      </RequireOnboarded>,
    );
    expect(await screen.findByText('app')).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('sends a signed-out visitor to sign-in', async () => {
    mockApi({ 'GET /api/v1/me': () => problem(401, 'UNAUTHENTICATED') });
    renderWithProviders(
      <RequireOnboarded>
        <p>app</p>
      </RequireOnboarded>,
    );
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('shows an error state with retry when the account cannot be loaded', async () => {
    mockApi({ 'GET /api/v1/me': () => problem(500, 'INTERNAL_ERROR') });
    renderWithProviders(
      <RequireOnboarded>
        <p>app</p>
      </RequireOnboarded>,
    );
    expect(await screen.findByText(t.loadFailedTitle)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });
});

describe('OnboardingFlow (onboarding gate)', () => {
  it('redirects a finished account away from /onboarding/1 to /home', async () => {
    mockApi({ 'GET /api/v1/me': () => json(done) });
    renderWithProviders(<OnboardingFlow step={1} />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/home'));
  });

  it('redirects to step 1 when a later step is opened without a username', async () => {
    mockApi({ 'GET /api/v1/me': () => json(baseMe) });
    renderWithProviders(<OnboardingFlow step={4} />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/onboarding/1'));
  });

  it('sends a signed-out visitor to sign-in', async () => {
    mockApi({ 'GET /api/v1/me': () => problem(401, 'UNAUTHENTICATED') });
    renderWithProviders(<OnboardingFlow step={1} />);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/sign-in'));
  });

  it('renders the step for an unfinished account', async () => {
    mockApi({ 'GET /api/v1/me': () => json({ ...baseMe, username: 'ana' }) });
    renderWithProviders(<OnboardingFlow step={4} />);
    expect(
      await screen.findByRole('heading', { level: 1, name: t.steps.progress.title }),
    ).toBeInTheDocument();
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it('shows an error state with retry when the account cannot be loaded', async () => {
    mockApi({ 'GET /api/v1/me': () => problem(500, 'INTERNAL_ERROR') });
    renderWithProviders(<OnboardingFlow step={1} />);
    expect(await screen.findByText(t.loadFailedTitle)).toBeInTheDocument();
  });

  it('finishing from the last step completes onboarding and goes home', async () => {
    const complete = { ...done };
    mockApi({
      'GET /api/v1/me': () => json({ ...baseMe, username: 'ana' }),
      'POST /api/v1/me/onboarding/complete': () => json(complete),
    });
    renderWithProviders(<OnboardingFlow step={7} />);
    const skip = await screen.findByRole('button', { name: t.skip });
    skip.click();
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/home'));
  });
});
