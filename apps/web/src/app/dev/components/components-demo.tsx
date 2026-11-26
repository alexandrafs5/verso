'use client';

// Dev demo: shared labels come from the i18n catalogs (M1.5); other demo copy stays hardcoded English.

import { useRouter } from 'next/navigation';
import { useFormatter, useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { type ReactNode, useState, useTransition } from 'react';
import { LOCALES } from '@verso/i18n';
import { TAG_COLORS } from '@verso/shared';
import { Button } from '@/components/ui/button';
import { setLocale } from '@/i18n/actions';
import {
  AddToLibraryButton,
  BookCover,
  type BookStatus,
  type CoverTone,
  EmptyState,
  ErrorState,
  GeneratedCover,
  LockToggle,
  ProgressBar,
  RatingDisplay,
  RatingInput,
  type RatingStyle,
  StatusDropdown,
  TagChip,
  type TagColor,
  type Visibility,
} from '@/components/verso';

const TONES: CoverTone[] = ['wine', 'tobacco', 'forest', 'navy', 'oxblood', 'slate'];
const RATING_STYLES: RatingStyle[] = [
  'STARS_WHOLE',
  'STARS_HALF',
  'STARS_QUARTER',
  'DECIMAL_10',
  'HUNDRED',
];

function formatRating(value: number | null, style: RatingStyle): string {
  if (value === null) return '';
  if (style === 'DECIMAL_10') return (value / 10).toFixed(1);
  if (style === 'HUNDRED') return String(value);
  return `${value / 20}`;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-border border-t pt-6">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-xs">{label}</p>
      <div className="flex flex-wrap items-end gap-4">{children}</div>
    </div>
  );
}

function ThemeSwitch() {
  const t = useTranslations('common');
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Button
      variant="secondary"
      onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
    >
      {t('theme')}
    </Button>
  );
}

function LocaleSwitch() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex items-center gap-2" role="group" aria-label={t('common.language')}>
      {LOCALES.map((l) => (
        <Button
          key={l}
          variant={l === locale ? 'primary' : 'secondary'}
          disabled={pending}
          aria-pressed={l === locale}
          onClick={() =>
            startTransition(async () => {
              await setLocale(l);
              router.refresh();
            })
          }
        >
          {t(`locale.${l}`)}
        </Button>
      ))}
    </div>
  );
}

function RatingInputDemo({ style }: { style: RatingStyle }) {
  const t = useTranslations('rating');
  const [value, setValue] = useState<number | null>(null);
  const labels = {
    clear: t('clear'),
    star: (n: number) => t('star', { count: n }),
    slider: t('slider'),
    field: t('field'),
  };
  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted text-xs">{style}</p>
      <RatingInput value={value} style={style} onChange={setValue} labels={labels} />
      <RatingDisplay
        value={value}
        style={style}
        formatted={formatRating(value, style)}
        emptyLabel={t('empty')}
      />
    </div>
  );
}

export function ComponentsDemo() {
  const t = useTranslations();
  const format = useFormatter();
  const statusLabels = {
    WANT_TO_READ: t('status.WANT_TO_READ'),
    READING: t('status.READING'),
    READ: t('status.READ'),
    ABANDONED: t('status.ABANDONED'),
  } satisfies Record<BookStatus, string>;
  const [status, setStatus] = useState<BookStatus>('READING');
  const [libraryStatus, setLibraryStatus] = useState<BookStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [visibility, setVisibility] = useState<Visibility>('PRIVATE');
  const [selectedTags, setSelectedTags] = useState<Set<TagColor>>(new Set(['WINE']));
  const [retries, setRetries] = useState(0);
  const [clicks, setClicks] = useState(0);

  function toggleTag(color: TagColor) {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(color)) next.delete(color);
      else next.add(color);
      return next;
    });
  }

  function addToLibrary(next: BookStatus) {
    setPending(true);
    setTimeout(() => {
      setLibraryStatus(next);
      setPending(false);
    }, 600);
  }

  return (
    <main className="mx-auto flex max-w-(--content-max) flex-col gap-8 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <h1>Verso components</h1>
        <div className="flex flex-wrap items-center gap-2">
          <LocaleSwitch />
          <ThemeSwitch />
        </div>
      </header>

      <Section title="BookCover and GeneratedCover">
        <Row label="Broken URL falls back to generated cover, sm / md; no URL, lg">
          <BookCover
            title="The Remains of the Day"
            author="Kazuo Ishiguro"
            coverUrl="https://invalid.example/missing.jpg"
            coverAlt="Cover of The Remains of the Day"
            tone="wine"
            size="sm"
          />
          <BookCover
            title="The Remains of the Day"
            author="Kazuo Ishiguro"
            coverUrl="https://invalid.example/missing.jpg"
            coverAlt="Cover of The Remains of the Day"
            tone="wine"
            size="md"
          />
          <BookCover
            title="The Remains of the Day"
            author="Kazuo Ishiguro"
            coverUrl={null}
            coverAlt="Cover of The Remains of the Day"
            tone="forest"
            size="lg"
          />
        </Row>
        <Row label="Loading, sm / md / lg">
          <BookCover title="" coverAlt="" tone="wine" size="sm" loading />
          <BookCover title="" coverAlt="" tone="wine" size="md" loading />
          <BookCover title="" coverAlt="" tone="wine" size="lg" loading />
        </Row>
        <Row label="All tones; navy has a long title, slate has no author">
          {TONES.map((tone) => (
            <div key={tone} className="w-28">
              <GeneratedCover
                title={
                  tone === 'navy' ? 'A Very Long Title That Needs Several Lines to Fit' : 'Dune'
                }
                author={tone === 'slate' ? undefined : 'Frank Herbert'}
                tone={tone}
              />
            </div>
          ))}
        </Row>
      </Section>

      <Section title="ProgressBar">
        <Row label="0, 42.5, 100, clamped (-5, 12000), loading">
          <div className="flex w-full max-w-md flex-col gap-4">
            <ProgressBar valueBp={0} label="Progress 0%" />
            <ProgressBar valueBp={4250} label="Progress 42.5%" />
            <ProgressBar valueBp={10000} label="Progress 100%" />
            <ProgressBar valueBp={-5} label="Progress clamped low" />
            <ProgressBar valueBp={12000} label="Progress clamped high" />
            <ProgressBar valueBp={5000} loading />
          </div>
        </Row>
      </Section>

      <Section title="RatingDisplay">
        <Row label="Unrated, stars (3.5), decimal, hundred">
          <RatingDisplay
            value={null}
            style="STARS_HALF"
            formatted=""
            emptyLabel={t('rating.empty')}
          />
          <RatingDisplay
            value={70}
            style="STARS_HALF"
            formatted="3.5"
            emptyLabel={t('rating.empty')}
          />
          <RatingDisplay
            value={73}
            style="DECIMAL_10"
            formatted="7.3"
            emptyLabel={t('rating.empty')}
          />
          <RatingDisplay value={73} style="HUNDRED" formatted="73" emptyLabel={t('rating.empty')} />
        </Row>
      </Section>

      <Section title="RatingInput">
        <div className="grid gap-6 md:grid-cols-2">
          {RATING_STYLES.map((style) => (
            <RatingInputDemo key={style} style={style} />
          ))}
        </div>
      </Section>

      <Section title="StatusDropdown and AddToLibraryButton">
        <Row label="StatusDropdown, enabled and disabled">
          <StatusDropdown status={status} options={statusLabels} onChange={setStatus} />
          <StatusDropdown
            status="READ"
            options={statusLabels}
            onChange={() => undefined}
            disabled
          />
        </Row>
        <Row label={`AddToLibraryButton (status: ${libraryStatus ?? 'none'}, pending: ${pending})`}>
          <AddToLibraryButton
            status={libraryStatus}
            labels={{
              add: t('library.add'),
              menu: t('library.chooseStatus'),
              options: statusLabels,
            }}
            onAdd={addToLibrary}
            onChange={setLibraryStatus}
            pending={pending}
          />
          <Button variant="ghost" onClick={() => setLibraryStatus(null)}>
            Reset
          </Button>
        </Row>
      </Section>

      <Section title="TagChip">
        <Row label="Static">
          {TAG_COLORS.map((color) => (
            <TagChip key={color} name={color.toLowerCase()} color={color} />
          ))}
        </Row>
        <Row label="Toggle (multi-select)">
          {TAG_COLORS.map((color) => (
            <TagChip
              key={color}
              name={`Favorites ${color.toLowerCase()}`}
              color={color}
              selected={selectedTags.has(color)}
              onToggle={() => toggleTag(color)}
            />
          ))}
        </Row>
      </Section>

      <Section title="LockToggle">
        <Row label={`Current: ${visibility}`}>
          <LockToggle
            visibility={visibility}
            label={t(`visibility.${visibility}`)}
            tooltip={
              visibility === 'PRIVATE'
                ? 'Private - inherited from this book'
                : 'Public - visible on your profile'
            }
            onToggle={() => setVisibility((v) => (v === 'PRIVATE' ? 'PUBLIC' : 'PRIVATE'))}
          />
        </Row>
      </Section>

      <Section title="Plurals, numbers and dates">
        <Row label="ICU plurals">
          {[0, 1, 2].map((n) => (
            <p key={n}>{t('plurals.books', { count: n })}</p>
          ))}
          <p>{t('plurals.pages', { count: 1 })}</p>
          <p>{t('plurals.days', { count: 5 })}</p>
        </Row>
        <Row label="Number and date formatting">
          <p>{format.number(1234567.89)}</p>
          <p>{format.number(0.425, { style: 'percent', maximumFractionDigits: 1 })}</p>
          <p>
            {format.dateTime(new Date(Date.UTC(2026, 10, 21, 12)), {
              dateStyle: 'long',
              timeZone: 'UTC',
            })}
          </p>
        </Row>
      </Section>

      <Section title="EmptyState">
        <Row label="With action (Spanish-length text)">
          <EmptyState
            heading="Empieza añadiendo el libro que estás leyendo ahora mismo"
            description="Busca un título en el catálogo y añádelo a tu biblioteca para seguir tu progreso."
            action={{ label: 'Buscar un libro', onClick: () => setClicks((c) => c + 1) }}
          />
        </Row>
        <p className="text-muted text-xs">Action clicks: {clicks}</p>
        <Row label="Without action">
          <EmptyState
            heading="No books in Abandoned"
            description="Books you stop reading will appear here."
          />
        </Row>
      </Section>

      <Section title="ErrorState">
        <Row label={`Retry count: ${retries}`}>
          <ErrorState
            heading="No hemos podido cargar tu biblioteca"
            description="Comprueba tu conexión e inténtalo de nuevo en unos segundos."
            retryLabel={t('common.retry')}
            onRetry={() => setRetries((r) => r + 1)}
          />
        </Row>
      </Section>
    </main>
  );
}
