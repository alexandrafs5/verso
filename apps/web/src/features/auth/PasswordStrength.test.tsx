import { render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { describe, expect, it } from 'vitest';
import { messages } from '@verso/i18n';
import { PasswordStrength, passwordStrength } from './PasswordStrength';

describe('passwordStrength', () => {
  it('returns null for an empty password', () => {
    expect(passwordStrength('')).toBeNull();
  });

  it('is weak when shorter than 8 characters', () => {
    expect(passwordStrength('aB3$')).toBe('weak');
  });

  it('is weak with 8+ characters of a single class', () => {
    expect(passwordStrength('abcdefghij')).toBe('weak');
    expect(passwordStrength('12345678')).toBe('weak');
  });

  it('is fair with 8+ characters and two classes', () => {
    expect(passwordStrength('abcdefg1')).toBe('fair');
    expect(passwordStrength('Abcdefghij')).toBe('fair');
  });

  it('is strong with 12+ characters and three classes', () => {
    expect(passwordStrength('Abcdefghij12')).toBe('strong');
  });

  it('is strong with 16+ characters and two classes', () => {
    expect(passwordStrength('abcdefghijklmno1')).toBe('strong');
  });

  it('is fair, not strong, with 12 characters and two classes', () => {
    expect(passwordStrength('abcdefghijk1')).toBe('fair');
  });
});

function renderStrength(password: string) {
  render(
    <NextIntlClientProvider locale="en" messages={messages.en}>
      <PasswordStrength password={password} />
    </NextIntlClientProvider>,
  );
}

describe('PasswordStrength', () => {
  it('shows the hint when empty', () => {
    renderStrength('');
    expect(screen.getByText(messages.en.auth.strength.hint)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it.each([
    ['abc', 'Weak'],
    ['abcdefg1', 'Fair'],
    ['Abcdefghij12', 'Strong'],
  ])('shows the level for %s', (password, label) => {
    renderStrength(password);
    expect(screen.getByRole('status')).toHaveTextContent(label);
  });
});
