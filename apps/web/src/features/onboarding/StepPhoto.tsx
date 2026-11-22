'use client';

import type { Me } from '@verso/shared';
import { useTranslations } from 'next-intl';
import { type ChangeEvent, type FormEvent, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useUpdateMe } from '@/features/me/use-me';
import { AvatarCropper } from './AvatarCropper';
import { INITIAL_CROP, type Crop, isAllowedImageType } from './avatar-geometry';
import { AvatarImageError, encodeAvatar, loadImage } from './avatar-image';
import { OnboardingShell, STEP_FORM_ID } from './OnboardingShell';
import { uploadAvatar } from './upload-avatar';

type ErrorKey = 'wrongType' | 'unreadable' | 'encode' | 'tooLarge' | 'upload' | 'remove';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.charAt(0) ?? '';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.charAt(0) ?? '') : '';
  return (first + last).toUpperCase();
}

type StepPhotoProps = { me: Me; onBack: () => void; onNext: () => void };

// Step 2 (optional): pick a photo, crop it to a circle, compress to WebP in the browser, upload
// through a signed URL, then save the path. A failure keeps the previous photo.
export function StepPhoto({ me, onBack, onNext }: StepPhotoProps) {
  const t = useTranslations('onboarding');
  const updateMe = useUpdateMe();
  const fileInput = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = useState<Crop>(INITIAL_CROP);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ErrorKey | null>(null);

  async function onFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset so choosing the same file again still fires a change.
    event.target.value = '';
    if (!file) return;

    setError(null);
    if (!isAllowedImageType(file.type)) {
      setError('wrongType');
      return;
    }
    try {
      setImage(await loadImage(file));
      setCrop(INITIAL_CROP);
    } catch {
      setError('unreadable');
    }
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!image) {
      onNext();
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const blob = await encodeAvatar(image, crop);
      const path = await uploadAvatar(blob);
      await updateMe.mutateAsync({ avatarPath: path });
      onNext();
    } catch (failure) {
      setError(failure instanceof AvatarImageError ? failure.kind : 'upload');
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setError(null);
    setBusy(true);
    try {
      await updateMe.mutateAsync({ removeAvatar: true });
    } catch {
      setError('remove');
    } finally {
      setBusy(false);
    }
  }

  const hasPhoto = Boolean(me.image);

  return (
    <OnboardingShell
      step={2}
      pending={busy}
      error={error ? t(`photo.errors.${error}`) : null}
      // Nothing to save without a photo: the only action is Skip.
      showPrimary={Boolean(image) || hasPhoto}
      primaryLabel={image ? t('photo.save') : undefined}
      onBack={onBack}
      onSkip={onNext}
    >
      <form id={STEP_FORM_ID} onSubmit={(event) => void onSubmit(event)}>
        <div className="flex flex-col items-center gap-6">
          {image ? (
            <AvatarCropper
              image={image}
              crop={crop}
              onCropChange={setCrop}
              disabled={busy}
              labels={{
                crop: t('photo.cropLabel'),
                hint: t('photo.cropHint'),
                zoom: t('photo.zoom'),
              }}
            />
          ) : me.image ? (
            <img
              src={me.image}
              alt={t('photo.currentAlt')}
              className="size-40 rounded-(--radius-round) border border-border object-cover"
            />
          ) : (
            <span
              role="img"
              aria-label={t('photo.initialsAlt', { initials: initialsOf(me.name) })}
              className="inline-flex size-40 items-center justify-center rounded-(--radius-round) bg-accent text-5xl font-medium text-on-accent"
            >
              {initialsOf(me.name)}
            </span>
          )}

          {busy ? (
            <p role="status" className="m-0 text-sm text-muted">
              {t('photo.processing')}
            </p>
          ) : null}

          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="sr-only"
            tabIndex={-1}
            aria-label={t('photo.fileInput')}
            onChange={(event) => void onFileChosen(event)}
          />
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
            >
              {image || hasPhoto ? t('photo.change') : t('photo.choose')}
            </Button>
            {hasPhoto && !image ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void onRemove()}>
                {t('photo.remove')}
              </Button>
            ) : null}
          </div>
        </div>
      </form>
    </OnboardingShell>
  );
}
