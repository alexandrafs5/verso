'use client';

import { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { GeneratedCover } from './GeneratedCover';
import type { CoverTone } from './types';

export type BookCoverSize = 'sm' | 'md' | 'lg';

const SIZE_WIDTH: Record<BookCoverSize, string> = {
  sm: 'w-16',
  md: 'w-28',
  lg: 'w-40',
};

type BookCoverProps = {
  title: string;
  author?: string;
  coverUrl?: string | null;
  /** Alt text for the cover, supplied by the caller (translated). */
  coverAlt: string;
  tone: CoverTone;
  size: BookCoverSize;
  loading?: boolean;
  className?: string;
};

export function BookCover({
  title,
  author,
  coverUrl,
  coverAlt,
  tone,
  size,
  loading = false,
  className,
}: BookCoverProps) {
  // Remember which URL failed so a new URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const width = SIZE_WIDTH[size];

  if (loading) {
    return (
      <Skeleton
        className={cn(
          'aspect-[2/3] rounded-l-(--radius-cover-spine) rounded-r-(--radius-cover-open)',
          width,
          className,
        )}
      />
    );
  }

  const showImage = Boolean(coverUrl) && coverUrl !== failedUrl;

  return (
    <div className={cn('shrink-0', width, className)}>
      {showImage ? (
        <img
          // The image can fail before hydration, so onError never fires: check on mount too.
          ref={(img) => {
            if (img?.complete && img.naturalWidth === 0) setFailedUrl(coverUrl ?? null);
          }}
          src={coverUrl as string}
          alt={coverAlt}
          loading="lazy"
          onError={() => setFailedUrl(coverUrl ?? null)}
          className="aspect-[2/3] w-full rounded-l-(--radius-cover-spine) rounded-r-(--radius-cover-open) bg-border object-cover"
        />
      ) : (
        <div role="img" aria-label={coverAlt}>
          <GeneratedCover title={title} author={author} tone={tone} />
        </div>
      )}
    </div>
  );
}
