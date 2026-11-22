import { AVATAR_MAX_BYTES } from '@verso/shared';
import { type Crop, OUTPUT_SIZE, cropGeometry } from './avatar-geometry';

export type AvatarImageErrorKind = 'unreadable' | 'encode' | 'tooLarge';

export class AvatarImageError extends Error {
  constructor(readonly kind: AvatarImageErrorKind) {
    super(`Avatar image error: ${kind}`);
    this.name = 'AvatarImageError';
  }
}

/** Decodes the picked file. The object URL is released as soon as the image has loaded. */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new AvatarImageError('unreadable'));
    };
    image.src = url;
  });
}

/** Draws the cropped square of the image into a canvas of any size. */
export function drawCrop(
  canvas: HTMLCanvasElement,
  image: HTMLImageElement,
  crop: Crop,
  size: number,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const { source } = cropGeometry(image.naturalWidth, image.naturalHeight, crop);
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, source.x, source.y, source.size, source.size, 0, 0, size, size);
}

const QUALITIES = [0.85, 0.7, 0.5];

const toBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', quality));

/**
 * Crops to a square, scales to 512 px and compresses to WebP under the 2 MB limit.
 * Browsers that cannot encode WebP return another type or null: that is an `encode` error.
 */
export async function encodeAvatar(image: HTMLImageElement, crop: Crop): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;
  drawCrop(canvas, image, crop, OUTPUT_SIZE);

  for (const quality of QUALITIES) {
    const blob = await toBlob(canvas, quality);
    if (!blob || blob.type !== 'image/webp') throw new AvatarImageError('encode');
    if (blob.size <= AVATAR_MAX_BYTES) return blob;
  }
  throw new AvatarImageError('tooLarge');
}
