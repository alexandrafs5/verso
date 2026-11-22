'use client';

import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef } from 'react';
import { drawCrop } from './avatar-image';
import { type Crop, MAX_ZOOM, MIN_ZOOM, VIEW_SIZE, normalizeCrop } from './avatar-geometry';

const KEY_STEP_PX = 12;
const ZOOM_STEP = 0.05;

type AvatarCropperProps = {
  image: HTMLImageElement;
  crop: Crop;
  onCropChange: (crop: Crop) => void;
  disabled?: boolean;
  labels: { crop: string; hint: string; zoom: string };
};

// Circle crop on a canvas, no library. Mouse and touch drag, arrow keys to move, a range input to
// zoom. The exported file is the square behind the circle; the circle is only CSS.
export function AvatarCropper({
  image,
  crop,
  onCropChange,
  disabled = false,
  labels,
}: AvatarCropperProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const hintId = useId();
  const zoomId = useId();

  useEffect(() => {
    if (canvasRef.current) drawCrop(canvasRef.current, image, crop, VIEW_SIZE);
  }, [image, crop]);

  const change = (next: Crop) =>
    onCropChange(normalizeCrop(image.naturalWidth, image.naturalHeight, next));

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    if (!drag.current) return;
    // The canvas may be shown smaller than VIEW_SIZE on narrow screens.
    const ratio = VIEW_SIZE / event.currentTarget.getBoundingClientRect().width || 1;
    const dx = (event.clientX - drag.current.x) * ratio;
    const dy = (event.clientY - drag.current.y) * ratio;
    drag.current = { x: event.clientX, y: event.clientY };
    change({ ...crop, panX: crop.panX + dx, panY: crop.panY + dy });
  }

  function onPointerEnd() {
    drag.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLCanvasElement>) {
    if (disabled) return;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-KEY_STEP_PX, 0],
      ArrowRight: [KEY_STEP_PX, 0],
      ArrowUp: [0, -KEY_STEP_PX],
      ArrowDown: [0, KEY_STEP_PX],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      change({ ...crop, panX: crop.panX + move[0], panY: crop.panY + move[1] });
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      change({ ...crop, zoom: crop.zoom + ZOOM_STEP * 2 });
    } else if (event.key === '-') {
      event.preventDefault();
      change({ ...crop, zoom: crop.zoom - ZOOM_STEP * 2 });
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <canvas
        ref={canvasRef}
        width={VIEW_SIZE}
        height={VIEW_SIZE}
        tabIndex={disabled ? -1 : 0}
        role="img"
        aria-label={labels.crop}
        aria-describedby={hintId}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
        // touch-action: none keeps a touch drag from scrolling the page.
        className="aspect-square w-full max-w-[280px] cursor-grab touch-none rounded-(--radius-round) border border-border bg-surface outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring active:cursor-grabbing"
      />
      <p id={hintId} className="m-0 text-center text-sm text-muted">
        {labels.hint}
      </p>
      <div className="flex w-full max-w-[280px] flex-col gap-1.5">
        <label htmlFor={zoomId} className="text-sm font-medium">
          {labels.zoom}
        </label>
        <input
          id={zoomId}
          type="range"
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={ZOOM_STEP}
          value={crop.zoom}
          disabled={disabled}
          onChange={(event) => change({ ...crop, zoom: Number(event.target.value) })}
          className="w-full accent-(--accent)"
        />
      </div>
    </div>
  );
}
