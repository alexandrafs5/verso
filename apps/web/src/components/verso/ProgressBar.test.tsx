import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar } from './ProgressBar';

describe('ProgressBar', () => {
  it('exposes a progressbar with aria-valuenow = valueBp / 100', () => {
    render(<ProgressBar valueBp={4250} label="Reading progress" />);
    const bar = screen.getByRole('progressbar', { name: 'Reading progress' });
    expect(bar).toHaveAttribute('aria-valuenow', '42.5');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps negative values to 0', () => {
    render(<ProgressBar valueBp={-5} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps values above 10000 to 10000', () => {
    render(<ProgressBar valueBp={12000} label="Progress" />);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('renders an empty track at 0', () => {
    render(<ProgressBar valueBp={0} label="Progress" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar.firstElementChild).toHaveStyle({ width: '0%' });
  });

  it('renders a skeleton instead of a progressbar while loading', () => {
    render(<ProgressBar valueBp={5000} loading />);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
