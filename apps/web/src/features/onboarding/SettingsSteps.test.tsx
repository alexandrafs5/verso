import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StepPrivacy } from './StepPrivacy';
import { StepProgressStyle } from './StepProgressStyle';
import { StepRatingStyle } from './StepRatingStyle';
import { baseMe, bodyOf, json, mockApi, problem, renderWithProviders, t } from './test-utils';

const SETTINGS = 'PATCH /api/v1/me/settings';
const me = { ...baseMe, username: 'ana' };

afterEach(() => vi.unstubAllGlobals());

function capture() {
  const bodies: unknown[] = [];
  mockApi({
    [SETTINGS]: (init) => {
      bodies.push(bodyOf(init));
      return json(me);
    },
  });
  return bodies;
}

describe('StepRatingStyle (step 3)', () => {
  it('starts on the saved style and saves the precision picked for stars', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const bodies = capture();
    renderWithProviders(<StepRatingStyle me={me} onBack={vi.fn()} onNext={onNext} />);

    expect(screen.getByRole('radio', { name: new RegExp(t.rating.stars.title) })).toBeChecked();
    await ui.click(screen.getByRole('radio', { name: new RegExp(t.rating.quarter) }));
    await ui.click(screen.getByRole('button', { name: t.continue }));

    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(bodies).toEqual([{ ratingStyle: 'STARS_QUARTER' }]);
  });

  it('saves the 1 to 10 and 1 to 100 styles and hides the star precision for them', async () => {
    const ui = userEvent.setup();
    const bodies = capture();
    renderWithProviders(<StepRatingStyle me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.click(screen.getByRole('radio', { name: new RegExp(t.rating.hundred.title) }));
    expect(
      screen.queryByRole('radio', { name: new RegExp(t.rating.whole) }),
    ).not.toBeInTheDocument();
    await ui.click(screen.getByRole('button', { name: t.continue }));

    await waitFor(() => expect(bodies).toEqual([{ ratingStyle: 'HUNDRED' }]));
  });

  it('shows an interactive preview for the selected style', async () => {
    const ui = userEvent.setup();
    capture();
    renderWithProviders(<StepRatingStyle me={me} onBack={vi.fn()} onNext={vi.fn()} />);

    await ui.click(screen.getByRole('radio', { name: /^1 to 10(?!0)/ }));
    const field = screen.getByLabelText('Rating value');
    await ui.type(field, '7.5');
    expect(field).toHaveValue('7.5');
  });

  it('shows an inline problem message when the save fails and stays on the step', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    mockApi({ [SETTINGS]: () => problem(500, 'INTERNAL_ERROR') });
    renderWithProviders(<StepRatingStyle me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.click(screen.getByRole('button', { name: t.continue }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.saveFailed);
    expect(onNext).not.toHaveBeenCalled();
  });

  it('Back calls onBack without saving', async () => {
    const ui = userEvent.setup();
    const onBack = vi.fn();
    const bodies = capture();
    renderWithProviders(<StepRatingStyle me={me} onBack={onBack} onNext={vi.fn()} />);

    await ui.click(screen.getByRole('button', { name: t.back }));
    expect(onBack).toHaveBeenCalledOnce();
    expect(bodies).toEqual([]);
  });
});

describe('StepProgressStyle (step 4)', () => {
  it('saves the chosen progress style', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const bodies = capture();
    renderWithProviders(<StepProgressStyle me={me} onBack={vi.fn()} onNext={onNext} />);

    expect(screen.getByRole('radio', { name: new RegExp(t.progress.pages.title) })).toBeChecked();
    await ui.click(screen.getByRole('radio', { name: new RegExp(t.progress.percent.title) }));
    await ui.click(screen.getByRole('button', { name: t.continue }));

    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(bodies).toEqual([{ progressStyle: 'PERCENT' }]);
  });

  it('previews both styles with a named progress bar', () => {
    capture();
    renderWithProviders(<StepProgressStyle me={me} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(t.progress.pages.preview)).toBeInTheDocument();
    expect(screen.getByText(t.progress.percent.preview)).toBeInTheDocument();
  });
});

describe('StepPrivacy (step 5)', () => {
  it('saves the chosen visibility', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const bodies = capture();
    renderWithProviders(<StepPrivacy me={me} onBack={vi.fn()} onNext={onNext} />);

    expect(screen.getByRole('radio', { name: new RegExp(t.privacy.public.title) })).toBeChecked();
    await ui.click(screen.getByRole('radio', { name: new RegExp(t.privacy.private.title) }));
    await ui.click(screen.getByRole('button', { name: t.continue }));

    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(bodies).toEqual([{ profileVisibility: 'PRIVATE' }]);
  });

  it('describes who sees what for each option', () => {
    capture();
    renderWithProviders(<StepPrivacy me={me} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(screen.getByText(t.privacy.public.description)).toBeInTheDocument();
    expect(screen.getByText(t.privacy.private.description)).toBeInTheDocument();
  });
});
