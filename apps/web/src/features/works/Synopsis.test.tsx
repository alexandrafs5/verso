import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Synopsis } from './Synopsis';

/** jsdom has no layout: fake the clamped and the full height of every element. */
function mockHeights(scrollHeight: number, clientHeight: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(scrollHeight);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(clientHeight);
}

const props = { text: 'Long text', readMoreLabel: 'Read more', readLessLabel: 'Read less' };

afterEach(() => vi.restoreAllMocks());

describe('Synopsis', () => {
  it('shows no button when the text fits', () => {
    mockHeights(100, 100);
    render(<Synopsis {...props} />);
    expect(screen.getByText('Long text')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows Read more when the text overflows, then toggles to Read less', async () => {
    mockHeights(300, 100);
    render(<Synopsis {...props} />);
    const paragraph = screen.getByText('Long text');
    expect(paragraph).toHaveClass('line-clamp-5');

    const more = screen.getByRole('button', { name: 'Read more' });
    expect(more).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(more);

    const less = screen.getByRole('button', { name: 'Read less' });
    expect(less).toHaveAttribute('aria-expanded', 'true');
    expect(paragraph).not.toHaveClass('line-clamp-5');
    await userEvent.click(less);
    expect(screen.getByRole('button', { name: 'Read more' })).toBeInTheDocument();
  });
});
