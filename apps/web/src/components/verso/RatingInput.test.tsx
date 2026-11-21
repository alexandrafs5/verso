import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { RatingInput } from './RatingInput';
import type { RatingStyle } from './types';

const labels = {
  clear: 'Clear rating',
  star: (n: number) => `${n} stars`,
  slider: 'Rating',
  field: 'Rating value',
};

function setup(style: RatingStyle, value: number | null = null) {
  const onChange = vi.fn();
  render(<RatingInput value={value} style={style} onChange={onChange} labels={labels} />);
  return onChange;
}

// jsdom has no layout: give the star row a 100 px box so clientX maps to 0-100 points.
function mockStarRow(el: HTMLElement) {
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    right: 100,
    top: 0,
    bottom: 32,
    width: 100,
    height: 32,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

describe('RatingInput stars', () => {
  it('STARS_HALF: left half of the third star calls onChange(50)', () => {
    const onChange = setup('STARS_HALF');
    const slider = screen.getByRole('slider', { name: 'Rating' });
    mockStarRow(slider);
    fireEvent.click(slider, { clientX: 45 });
    expect(onChange).toHaveBeenCalledWith(50);
  });

  it('STARS_HALF: right half of the third star calls onChange(60)', () => {
    const onChange = setup('STARS_HALF');
    const slider = screen.getByRole('slider', { name: 'Rating' });
    mockStarRow(slider);
    fireEvent.click(slider, { clientX: 55 });
    expect(onChange).toHaveBeenCalledWith(60);
  });

  it('STARS_HALF: clicking the current value again calls onChange(null)', () => {
    const onChange = setup('STARS_HALF', 50);
    const slider = screen.getByRole('slider', { name: 'Rating' });
    mockStarRow(slider);
    fireEvent.click(slider, { clientX: 45 });
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('the clear action calls onChange(null)', async () => {
    const onChange = setup('STARS_HALF', 50);
    await userEvent.click(screen.getByRole('button', { name: 'Clear rating' }));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('STARS_WHOLE: arrow keys change the value by 20', async () => {
    const onChange = setup('STARS_WHOLE', 40);
    screen.getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(60);
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(20);
  });

  it('STARS_WHOLE: arrow keys clamp to 0-100', async () => {
    const onChange = setup('STARS_WHOLE', 100);
    screen.getByRole('slider').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(onChange).toHaveBeenLastCalledWith(100);
  });

  it('STARS_WHOLE: ArrowLeft at 20 clamps at 0', async () => {
    const onChange = setup('STARS_WHOLE', 0);
    screen.getByRole('slider').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it('exposes the unrated state as value 0 with no spoken value', () => {
    setup('STARS_WHOLE', null);
    const slider = screen.getByRole('slider');
    expect(slider).toHaveAttribute('aria-valuenow', '0');
    expect(slider).not.toHaveAttribute('aria-valuetext');
  });
});

describe('RatingInput numeric styles', () => {
  it('DECIMAL_10: typing 7.3 calls onChange(73)', async () => {
    const onChange = setup('DECIMAL_10');
    await userEvent.type(screen.getByRole('textbox', { name: 'Rating value' }), '7.3');
    expect(onChange).toHaveBeenLastCalledWith(73);
  });

  it('HUNDRED: typing 73 calls onChange(73)', async () => {
    const onChange = setup('HUNDRED');
    await userEvent.type(screen.getByRole('textbox', { name: 'Rating value' }), '73');
    expect(onChange).toHaveBeenLastCalledWith(73);
  });

  it('HUNDRED: out-of-range text does not call onChange and is flagged invalid', async () => {
    const onChange = setup('HUNDRED');
    const field = screen.getByRole('textbox', { name: 'Rating value' });
    await userEvent.type(field, '150');
    expect(onChange).not.toHaveBeenCalledWith(150);
    expect(field).toBeInvalid();
  });

  it('clearing the field calls onChange(null)', async () => {
    const onChange = setup('HUNDRED', 40);
    await userEvent.clear(screen.getByRole('textbox', { name: 'Rating value' }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });
});
