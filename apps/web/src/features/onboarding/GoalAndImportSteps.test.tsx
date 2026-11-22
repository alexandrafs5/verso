import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepGoal } from './StepGoal';
import { StepImport } from './StepImport';
import { baseMe, bodyOf, json, mockApi, problem, renderWithProviders, t } from './test-utils';

const me = { ...baseMe, username: 'ana' };
const YEAR = new Date().getFullYear();

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.useRealTimers());

const field = () => screen.getByLabelText(t.goal.label.replace('{year}', String(YEAR)));

describe('StepGoal (step 6)', () => {
  it('labels the field with the current year in the account time zone', () => {
    mockApi({});
    renderWithProviders(<StepGoal me={me} onBack={vi.fn()} onNext={vi.fn()} />);
    expect(field()).toHaveAttribute('type', 'number');
    expect(screen.getByRole('button', { name: t.skip })).toBeInTheDocument();
  });

  it('saves the goal for the year and moves on', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    let body: unknown;
    mockApi({
      [`PUT /api/v1/me/goals/${YEAR}`]: (init) => {
        body = bodyOf(init);
        return json({ year: YEAR, targetBooks: 24 });
      },
    });
    renderWithProviders(<StepGoal me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.type(field(), '24');
    await ui.click(screen.getByRole('button', { name: t.continue }));

    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
    expect(body).toEqual({ targetBooks: 24 });
  });

  it('moves on without saving anything when the field is left empty', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const fetchMock = mockApi({});
    renderWithProviders(<StepGoal me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.click(screen.getByRole('button', { name: t.continue }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each(['0', '1000', '2.5', '-3'])('rejects %s and sends nothing', async (typed) => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const fetchMock = mockApi({});
    renderWithProviders(<StepGoal me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.type(field(), typed);
    await ui.click(screen.getByRole('button', { name: t.continue }));

    expect(screen.getByText(t.goal.invalid)).toBeInTheDocument();
    expect(field()).toHaveAttribute('aria-invalid', 'true');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(onNext).not.toHaveBeenCalled();
  });

  it('shows an inline problem message with retry when the save fails', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    let fail = true;
    mockApi({
      [`PUT /api/v1/me/goals/${YEAR}`]: () =>
        fail ? problem(500, 'INTERNAL_ERROR') : json({ year: YEAR, targetBooks: 12 }),
    });
    renderWithProviders(<StepGoal me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.type(field(), '12');
    await ui.click(screen.getByRole('button', { name: t.continue }));
    expect(await screen.findByRole('alert')).toHaveTextContent(t.saveFailed);
    expect(onNext).not.toHaveBeenCalled();

    fail = false;
    await ui.click(screen.getByRole('button', { name: t.continue }));
    await waitFor(() => expect(onNext).toHaveBeenCalledOnce());
  });

  it('Skip moves on without saving', async () => {
    const ui = userEvent.setup();
    const onNext = vi.fn();
    const fetchMock = mockApi({});
    renderWithProviders(<StepGoal me={me} onBack={vi.fn()} onNext={onNext} />);

    await ui.type(field(), '30');
    await ui.click(screen.getByRole('button', { name: t.skip }));
    expect(onNext).toHaveBeenCalledOnce();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('StepImport (step 7)', () => {
  it('explains the import and offers only Skip, with no import action', () => {
    renderWithProviders(
      <StepImport pending={false} failed={false} onBack={vi.fn()} onSkip={vi.fn()} />,
    );

    expect(screen.getByText(t.import.body)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t.skip })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t.continue })).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /import/i })).not.toBeInTheDocument();
  });

  it('Skip finishes onboarding and Back goes back', async () => {
    const ui = userEvent.setup();
    const onSkip = vi.fn();
    const onBack = vi.fn();
    renderWithProviders(
      <StepImport pending={false} failed={false} onBack={onBack} onSkip={onSkip} />,
    );

    await ui.click(screen.getByRole('button', { name: t.skip }));
    await ui.click(screen.getByRole('button', { name: t.back }));
    expect(onSkip).toHaveBeenCalledOnce();
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('shows an inline problem message when finishing fails', () => {
    renderWithProviders(<StepImport pending={false} failed onBack={vi.fn()} onSkip={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent(t.saveFailed);
  });
});
