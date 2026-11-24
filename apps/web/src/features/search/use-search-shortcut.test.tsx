import { act, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../onboarding/test-utils';
import { TopBarSearch } from './TopBarSearch';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function setDesktop(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
}

function press(init: KeyboardEventInit) {
  const event = new KeyboardEvent('keydown', {
    key: 'k',
    bubbles: true,
    cancelable: true,
    ...init,
  });
  window.dispatchEvent(event);
  return event;
}

afterEach(() => vi.unstubAllGlobals());

describe('search shortcut', () => {
  it.each([
    ['Ctrl+K', { ctrlKey: true }],
    ['Cmd+K', { metaKey: true }],
  ])('%s focuses the field and blocks the browser handler', (_name, init) => {
    setDesktop(true);
    window.localStorage.setItem('verso:recent-searches:v1', '["dune"]');
    renderWithProviders(<TopBarSearch />);
    const field = screen.getByRole('combobox');
    let event!: KeyboardEvent;
    act(() => {
      event = press(init);
    });
    expect(field).toHaveFocus();
    expect(event.defaultPrevented).toBe(true);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    window.localStorage.clear();
  });

  it('does not block the browser handler when the field is already focused', () => {
    setDesktop(true);
    renderWithProviders(<TopBarSearch />);
    const field = screen.getByRole('combobox');
    field.focus();
    let event!: KeyboardEvent;
    act(() => {
      event = press({ ctrlKey: true });
    });
    expect(event.defaultPrevented).toBe(false);
    expect(field).toHaveFocus();
  });

  it('is ignored below 768px', () => {
    setDesktop(false);
    renderWithProviders(<TopBarSearch />);
    let event!: KeyboardEvent;
    act(() => {
      event = press({ ctrlKey: true });
    });
    expect(screen.getByRole('combobox')).not.toHaveFocus();
    expect(event.defaultPrevented).toBe(false);
  });

  it('ignores K without a modifier and other combinations', () => {
    setDesktop(true);
    renderWithProviders(<TopBarSearch />);
    press({});
    press({ ctrlKey: true, shiftKey: true });
    press({ ctrlKey: true, altKey: true });
    fireEvent.keyDown(window, { key: 'j', ctrlKey: true });
    expect(screen.getByRole('combobox')).not.toHaveFocus();
  });

  it('still focuses the field when pressed inside another text input', () => {
    setDesktop(true);
    renderWithProviders(
      <div>
        <TopBarSearch />
        <textarea aria-label="notes" />
      </div>,
    );
    const notes = screen.getByRole('textbox', { name: 'notes' });
    notes.focus();
    act(() => {
      notes.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }),
      );
    });
    expect(screen.getByRole('combobox')).toHaveFocus();
  });
});
