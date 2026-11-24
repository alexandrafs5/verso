import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../onboarding/test-utils';
import { MoreMatches } from './MoreMatches';

const work = (ref: string, title: string) => ({
  ref,
  title,
  authors: [{ ref: 'ol:OL1A', name: 'Juan Rulfo' }],
  firstPublishYear: 1955,
  coverUrl: null,
  editionCount: 1,
  libraryStatus: null,
});

const works = [work('ol:OL7W', 'Study one'), work('ol:OL8W', 'Study two')];

describe('MoreMatches', () => {
  it('renders nothing without folded works', () => {
    const { container } = renderWithProviders(<MoreMatches works={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows a collapsed button with the count and hides the rows', () => {
    renderWithProviders(<MoreMatches works={works} />);
    const button = screen.getByRole('button', { name: 'Show more matches (2)' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('link', { name: /Study one/ })).not.toBeInTheDocument();
  });

  it('expands and collapses the rows', async () => {
    renderWithProviders(<MoreMatches works={works} />);
    await userEvent.click(screen.getByRole('button', { name: 'Show more matches (2)' }));
    const button = screen.getByRole('button', { name: 'Hide more matches (2)' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /Study one/ })).toBeVisible();
    expect(screen.getByRole('link', { name: /Study two/ })).toBeVisible();
    expect(button.getAttribute('aria-controls')).toBe(
      screen.getByRole('link', { name: /Study one/ }).closest('ul')?.id,
    );

    await userEvent.click(button);
    expect(screen.getByRole('button', { name: 'Show more matches (2)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    expect(screen.queryByRole('link', { name: /Study one/ })).not.toBeInTheDocument();
  });

  it('resets to collapsed when the parent changes its key', async () => {
    function Harness() {
      const [key, setKey] = useState('a');
      return (
        <>
          <button onClick={() => setKey('b')}>new query</button>
          <MoreMatches key={key} works={works} />
        </>
      );
    }
    renderWithProviders(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Show more matches (2)' }));
    expect(screen.getByRole('button', { name: 'Hide more matches (2)' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'new query' }));
    expect(screen.getByRole('button', { name: 'Show more matches (2)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
