'use client';

import type { AuthorDetail } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Synopsis } from '@/features/works/Synopsis';
import { authorInitials } from './author-utils';

function AuthorPhoto({ author }: { author: Pick<AuthorDetail, 'name' | 'photoUrl'> }) {
  const t = useTranslations('author');
  // Remember which URL failed so a new URL gets a fresh attempt.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const showImage = Boolean(author.photoUrl) && author.photoUrl !== failedUrl;

  return showImage ? (
    <img
      src={author.photoUrl as string}
      alt={t('photoAlt', { name: author.name })}
      onError={() => setFailedUrl(author.photoUrl)}
      className="size-32 shrink-0 rounded-full bg-border object-cover md:size-40"
    />
  ) : (
    <div
      role="img"
      aria-label={t('photoAlt', { name: author.name })}
      className="flex size-32 shrink-0 items-center justify-center rounded-full bg-(--tobacco) font-serif text-4xl text-background md:size-40 md:text-5xl"
    >
      <span aria-hidden="true">{authorInitials(author.name)}</span>
    </div>
  );
}

/** "1917–1986", "1917–" when only the birth is known, null otherwise. */
function useLifeSpan(author: Pick<AuthorDetail, 'birthYear' | 'deathYear'>): string | null {
  const t = useTranslations('author');
  if (author.birthYear === null) return null;
  return author.deathYear === null
    ? t('lifeSpanBorn', { birth: author.birthYear })
    : t('lifeSpan', { birth: author.birthYear, death: author.deathYear });
}

export function AuthorHeader({ author }: { author: AuthorDetail }) {
  const t = useTranslations('author');
  const lifeSpan = useLifeSpan(author);

  return (
    <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
      <AuthorPhoto author={author} />
      <div className="min-w-0 flex-1 space-y-3 text-center md:text-left">
        <h1 className="font-serif text-3xl leading-tight break-words md:text-4xl">{author.name}</h1>
        {lifeSpan ? <p className="text-muted">{lifeSpan}</p> : null}
        {author.bio ? (
          <section aria-label={t('biographyLabel')} className="text-left">
            <Synopsis
              text={author.bio}
              readMoreLabel={t('readMore')}
              readLessLabel={t('readLess')}
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
