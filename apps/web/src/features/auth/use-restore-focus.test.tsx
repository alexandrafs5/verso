import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { describe, expect, it } from 'vitest';
import { useRestoreFocus } from './use-restore-focus';

function Harness({ busy }: { busy: boolean }) {
  useRestoreFocus(busy);
  return (
    <>
      <input aria-label="field" disabled={busy} />
      <button type="button" disabled={busy}>
        go
      </button>
    </>
  );
}

describe('useRestoreFocus', () => {
  it('returns focus to the control that was focused before it was disabled', () => {
    const { rerender } = render(<Harness busy={false} />);
    const button = screen.getByRole('button', { name: 'go' });
    act(() => button.focus());
    expect(button).toHaveFocus();

    rerender(<Harness busy />);
    act(() => button.blur()); // browsers drop focus when a focused control is disabled
    expect(document.body).toHaveFocus();

    rerender(<Harness busy={false} />);
    expect(button).toHaveFocus();
  });

  it('does not steal focus that moved somewhere else on purpose', () => {
    const { rerender } = render(<Harness busy={false} />);
    const input = screen.getByLabelText('field');
    const button = screen.getByRole('button', { name: 'go' });
    act(() => button.focus());

    rerender(<Harness busy />);
    act(() => button.blur());
    rerender(<Harness busy={false} />);
    act(() => input.focus());
    expect(input).toHaveFocus();
  });

  it('does nothing when it was never busy', () => {
    render(<Harness busy={false} />);
    expect(document.body).toHaveFocus();
  });
});
