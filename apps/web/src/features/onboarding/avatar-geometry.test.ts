import { describe, expect, it } from 'vitest';
import {
  INITIAL_CROP,
  MAX_ZOOM,
  MIN_ZOOM,
  VIEW_SIZE,
  cropGeometry,
  isAllowedImageType,
  normalizeCrop,
} from './avatar-geometry';

describe('cropGeometry', () => {
  it('centers a landscape image and shows its full height at zoom 1', () => {
    const g = cropGeometry(400, 200, INITIAL_CROP);
    expect(g.source.size).toBeCloseTo(200);
    expect(g.source.x).toBeCloseTo(100);
    expect(g.source.y).toBeCloseTo(0);
  });

  it('centers a portrait image and shows its full width at zoom 1', () => {
    const g = cropGeometry(200, 400, INITIAL_CROP);
    expect(g.source.size).toBeCloseTo(200);
    expect(g.source.x).toBeCloseTo(0);
    expect(g.source.y).toBeCloseTo(100);
  });

  it('shows a smaller part of the image when zoomed in', () => {
    const g = cropGeometry(200, 200, { ...INITIAL_CROP, zoom: 2 });
    expect(g.source.size).toBeCloseTo(100);
    expect(g.source.x).toBeCloseTo(50);
  });

  it('clamps the zoom to the allowed range', () => {
    expect(cropGeometry(200, 200, { ...INITIAL_CROP, zoom: 99 }).crop.zoom).toBe(MAX_ZOOM);
    expect(cropGeometry(200, 200, { ...INITIAL_CROP, zoom: 0 }).crop.zoom).toBe(MIN_ZOOM);
  });

  it('clamps the pan so the image keeps covering the view', () => {
    const g = cropGeometry(400, 200, { zoom: 1, panX: 9999, panY: 9999 });
    // Landscape at zoom 1: free to move sideways, not vertically.
    expect(g.maxPanY).toBe(0);
    expect(g.crop.panY).toBe(0);
    expect(g.crop.panX).toBe(g.maxPanX);
    expect(g.source.x).toBeCloseTo(0);
  });

  it('moving the image right reveals more of its left side', () => {
    const centered = cropGeometry(400, 200, INITIAL_CROP);
    const panned = cropGeometry(400, 200, { zoom: 1, panX: 50, panY: 0 });
    expect(panned.source.x).toBeLessThan(centered.source.x);
  });

  it('always keeps the source square inside the image', () => {
    for (const [w, h] of [
      [400, 200],
      [200, 400],
      [300, 300],
    ] as const) {
      for (const zoom of [1, 1.7, 3]) {
        for (const pan of [-5000, 0, 5000]) {
          const { source } = cropGeometry(w, h, { zoom, panX: pan, panY: pan });
          expect(source.x).toBeGreaterThanOrEqual(-1e-9);
          expect(source.y).toBeGreaterThanOrEqual(-1e-9);
          expect(source.x + source.size).toBeLessThanOrEqual(w + 1e-9);
          expect(source.y + source.size).toBeLessThanOrEqual(h + 1e-9);
        }
      }
    }
  });

  it('scales the pan limit with the view size', () => {
    expect(cropGeometry(400, 200, INITIAL_CROP, VIEW_SIZE).maxPanX).toBeCloseTo(VIEW_SIZE / 2);
  });
});

describe('normalizeCrop', () => {
  it('returns a crop inside the limits', () => {
    expect(normalizeCrop(200, 200, { zoom: 1, panX: 50, panY: 50 })).toEqual({
      zoom: 1,
      panX: 0,
      panY: 0,
    });
  });
});

describe('isAllowedImageType', () => {
  it('accepts jpeg, png, webp and gif', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/webp', 'image/gif']) {
      expect(isAllowedImageType(type)).toBe(true);
    }
  });

  it('rejects svg, pdf and unknown types', () => {
    for (const type of ['image/svg+xml', 'application/pdf', 'text/plain', '']) {
      expect(isAllowedImageType(type)).toBe(false);
    }
  });
});
