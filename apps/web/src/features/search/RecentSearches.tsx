'use client';

import { useTranslations } from 'next-intl';
import { XIcon } from '@/components/ui/icons';
import { focusRing } from '@/components/shell/nav';
import { cn } from '@/lib/utils';

type Props = {
  listId: string;
  items: string[];
  activeIndex: number;
  optionId: (index: number) => string;
  onPick: (text: string) => void;
  onRemove: (text: string) => void;
  onClear: () => void;
};

// Options and remove buttons share this height so the two columns line up.
const ROW = 'h-9';

export function RecentSearches({
  listId,
  items,
  activeIndex,
  optionId,
  onPick,
  onRemove,
  onClear,
}: Props) {
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
      {/* A listbox holds only options, so the remove buttons sit in a column beside it. */}
      <div className="flex">
        <div id={listId} role="listbox" aria-label={t('heading')} className="min-w-0 flex-1">
          {items.map((text, index) => (
            <div
              key={text}
              id={optionId(index)}
              role="option"
              aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPick(text)}
              className={cn(
                ROW,
                'flex cursor-pointer items-center truncate px-3 text-sm text-foreground',
                index === activeIndex ? 'bg-surface' : 'hover:bg-surface',
              )}
            >
              {text}
            </div>
          ))}
        </div>
        <div className="flex flex-col">
          {items.map((text) => (
            <div key={text} className={cn(ROW, 'flex items-center')}>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
