'use client';

import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export type Strength = 'weak' | 'fair' | 'strong';

/**
 * Hint only: it never blocks submit. Counts character classes and length.
 * Returns null for an empty password so the bars stay neutral.
 */
export function passwordStrength(password: string): Strength | null {
  if (password.length === 0) return null;

  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;

  if (password.length < 8 || classes < 2) return 'weak';
  if ((password.length >= 12 && classes >= 3) || (password.length >= 16 && classes >= 2)) {
    return 'strong';
  }
  return 'fair';
}

const LEVELS: Record<Strength, { filled: number; bar: string; text: string }> = {
  weak: { filled: 1, bar: 'bg-danger', text: 'text-danger' },
  fair: { filled: 2, bar: 'bg-warning', text: 'text-warning' },
  strong: { filled: 3, bar: 'bg-success', text: 'text-success' },
};

type PasswordStrengthProps = { password: string; id?: string; className?: string };

export function PasswordStrength({ password, id, className }: PasswordStrengthProps) {
  const t = useTranslations('auth.strength');
  const strength = passwordStrength(password);
  const level = strength ? LEVELS[strength] : null;

  return (
    <div id={id} className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              'h-0.75 flex-1 rounded-(--radius-chip) transition-colors duration-(--duration-base) motion-reduce:transition-none',
              level && n <= level.filled ? level.bar : 'bg-border',
            )}
          />
        ))}
      </div>
      <p className="m-0 text-xs text-muted">
        {strength && level ? (
          <span role="status" className={cn('font-medium', level.text)}>
            <span className="sr-only">{t('label')}: </span>
            {t(strength)}
          </span>
        ) : (
          t('hint')
        )}
      </p>
    </div>
  );
}
