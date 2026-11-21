import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import type { CoverTone } from './types';

const TONE_BG: Record<CoverTone, string> = {
  wine: 'bg-(--tag-wine)',
  tobacco: 'bg-(--tag-tobacco)',
  forest: 'bg-(--tag-forest)',
  navy: 'bg-(--tag-navy)',
  oxblood: 'bg-(--tag-oxblood)',
  slate: 'bg-(--tag-slate)',
};

type GeneratedCoverProps = Omit<ComponentProps<'div'>, 'children'> & {
  title: string;
  author?: string;
  tone: CoverTone;
};

// Fills its parent at 2:3. Type scales with the cover width through container query units.
export function GeneratedCover({ title, author, tone, className, ...props }: GeneratedCoverProps) {
  return (
    <div
      className={cn(
        '@container relative aspect-[2/3] w-full overflow-hidden',
        'rounded-l-(--radius-cover-spine) rounded-r-(--radius-cover-open)',
        TONE_BG[tone],
        className,
      )}
      {...props}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-[3cqw] border border-(--cover-frame)"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-between px-[12cqw] pt-[22cqw] pb-[14cqw] text-center text-(--cover-ink)">
        <span className="line-clamp-5 font-serif text-[length:12cqw] leading-[1.1] italic">
          {title}
        </span>
        {author ? (
          <span className="line-clamp-2 font-sans font-medium text-[length:5cqw] uppercase leading-tight tracking-[0.12em]">
            {author}
          </span>
        ) : null}
      </div>
    </div>
  );
}
