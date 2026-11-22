/** Pure crop math for the avatar. The canvas calls live in avatar-image.ts. */

/** Edge of the square crop view, in CSS px. */
export const VIEW_SIZE = 280;
/** Edge of the exported square, in px. */
export const OUTPUT_SIZE = 512;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export type Crop = {
  /** 1 = the image just covers the square; up to 3. */
  zoom: number;
  /** How far the image centre sits from the view centre, in view px. */
  panX: number;
  panY: number;
};

export const INITIAL_CROP: Crop = { zoom: 1, panX: 0, panY: 0 };

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export const isAllowedImageType = (type: string): boolean =>
  (ALLOWED_IMAGE_TYPES as readonly string[]).includes(type);

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export type CropGeometry = {
  crop: Crop;
  /** View px per image px. */
  scale: number;
  maxPanX: number;
  maxPanY: number;
  /** The square of the source image that shows in the view, in image px. */
  source: { x: number; y: number; size: number };
};

/** The pan is clamped so the image always covers the whole view: no empty corners in the export. */
export function cropGeometry(
  imageWidth: number,
  imageHeight: number,
  crop: Crop,
  viewSize: number = VIEW_SIZE,
): CropGeometry {
  const zoom = clamp(crop.zoom, MIN_ZOOM, MAX_ZOOM);
  const scale = (viewSize / Math.min(imageWidth, imageHeight)) * zoom;
  const maxPanX = Math.max(0, (imageWidth * scale - viewSize) / 2);
  const maxPanY = Math.max(0, (imageHeight * scale - viewSize) / 2);
  const panX = clamp(crop.panX, -maxPanX, maxPanX);
  const panY = clamp(crop.panY, -maxPanY, maxPanY);

  const size = viewSize / scale;
  const centerX = imageWidth / 2 - panX / scale;
  const centerY = imageHeight / 2 - panY / scale;

  return {
    crop: { zoom, panX, panY },
    scale,
    maxPanX,
    maxPanY,
    source: { x: centerX - size / 2, y: centerY - size / 2, size },
  };
}

export const normalizeCrop = (imageWidth: number, imageHeight: number, crop: Crop): Crop =>
  cropGeometry(imageWidth, imageHeight, crop).crop;
