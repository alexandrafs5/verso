'use client';

import { useTranslations } from 'next-intl';
import { XIcon } from '@/components/ui/icons';
import { focusRing } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

type Props = {
  items: string[];
  activeIndex: number;
  optionId: (index: number) => string;
  onPick: (text: string) => void;
  onRemove: (text: string) => void;
  onClear: () => void;
};

export function RecentSearches({ items, activeIndex, optionId, onPick, onRemove, onClear }: Props) {
  const t = useTranslations('search.recent');
  if (items.length === 0) return null;
  return (
    <div>
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{t('heading')}</p>
        <button
          type="button"
          onClick={onClear}
          className={cn(
            'rounded-(--radius-chip) px-2 py-1 text-xs text-accent-text hover:underline',
            focusRing,
          )}
        >
          {t('clearAll')}
        </button>
      </div>
      <ul role="presentation">
        {items.map((text, index) => (
          <li key={text} role="presentation" className="flex items-center">
            <div
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(text)}
              className={cn(
                'flex-1 cursor-pointer truncate px-3 py-2 text-sm text-foreground',
                index === activeIndex ? 'bg-surface' : 'hover:bg-surface',
              )}
            >
              {text}
            </div>
            <button
              type="button"
              aria-label={t('remove', { query: text })}
              onClick={() => onRemove(text)}
              className={cn(
                'mr-1 inline-flex size-9 items-center justify-center rounded-(--radius-chip) text-muted hover:text-foreground',
                focusRing,
              )}
            >
              <XIcon width={14} height={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
