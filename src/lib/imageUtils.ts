import type { ImageAdjustments, Transform } from '../types';

// ─── CSS Helpers ────────────────────────────────────────────────────────────

/**
 * Build a CSS filter string from ImageAdjustments.
 *
 * Fast path: pure CSS filter, no canvas, no worker.
 * All Phase 1 adjustments are handled here.
 */
export function buildCssFilter(adj: ImageAdjustments): string {
  const parts: string[] = [];

  if (adj.brightness !== 100) parts.push(`brightness(${adj.brightness}%)`);
  if (adj.contrast !== 100) parts.push(`contrast(${adj.contrast}%)`);
  if (adj.saturation !== 100) parts.push(`saturate(${adj.saturation}%)`);
  if (adj.grayscale > 0) parts.push(`grayscale(${adj.grayscale}%)`);
  if (adj.invert > 0) parts.push(`invert(${adj.invert}%)`);
  if (adj.blur > 0) parts.push(`blur(${adj.blur}px)`);

  return parts.join(' ') || 'none';
}

/**
 * Build a CSS transform string from Transform state.
 *
 * Order matters: translate → rotate → scale.
 * Flip is applied as a negative scale on the relevant axis.
 */
export function buildCssTransform(t: Transform): string {
  const scaleX = t.flipH ? -t.scale : t.scale;
  const scaleY = t.flipV ? -t.scale : t.scale;
  return [
    `translate(${t.x}px, ${t.y}px)`,
    `rotate(${t.rotation}deg)`,
    `scale(${scaleX}, ${scaleY})`,
  ].join(' ');
}

// ─── Touch Geometry ─────────────────────────────────────────────────────────

/** Euclidean distance between two touch points */
export function getTouchDistance(touches: React.TouchList | TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Angle in degrees between two touch points (relative to horizontal axis) */
export function getTouchAngle(touches: React.TouchList | TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.atan2(dy, dx) * (180 / Math.PI);
}

/** Midpoint between two touch points */
export function getTouchMidpoint(
  touches: React.TouchList | TouchList
): { x: number; y: number } {
  if (touches.length < 2) {
    return { x: touches[0].clientX, y: touches[0].clientY };
  }
  return {
    x: (touches[0].clientX + touches[1].clientX) / 2,
    y: (touches[0].clientY + touches[1].clientY) / 2,
  };
}

// ─── Math Utilities ─────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ─── Transform Calculations ─────────────────────────────────────────────────

/**
 * Compute a scale that fits imageWidth × imageHeight inside
 * containerWidth × containerHeight (letterbox/pillarbox — preserves aspect ratio).
 *
 * IMPORTANT: imageWidth/imageHeight must be the DISPLAY dimensions
 * (i.e., UploadedImage.displayWidth/displayHeight), not the natural/original
 * dimensions. The overlay <img> renders at display dimensions, so fit
 * calculations must use those same dimensions.
 *
 * x/y are always 0 (centered) for a fit operation.
 */
export function computeFitTransform(
  displayWidth: number,
  displayHeight: number,
  containerWidth: number,
  containerHeight: number
): Pick<Transform, 'scale' | 'x' | 'y'> {
  if (displayWidth === 0 || displayHeight === 0) {
    return { scale: 1, x: 0, y: 0 };
  }
  const scaleX = containerWidth / displayWidth;
  const scaleY = containerHeight / displayHeight;
  // Use the smaller scale to ensure the full image is visible
  const scale = Math.min(scaleX, scaleY);
  return { scale, x: 0, y: 0 };
}

/**
 * Compute an initial fit transform that leaves a small margin (~5%)
 * so the image doesn't touch the toolbar edges.
 */
export function computeInitialFitTransform(
  displayWidth: number,
  displayHeight: number,
  containerWidth: number,
  containerHeight: number
): Transform {
  const fit = computeFitTransform(displayWidth, displayHeight, containerWidth, containerHeight);
  return {
    x: 0,
    y: 0,
    scale: fit.scale * 0.92, // 8% margin
    rotation: 0,
    flipH: false,
    flipV: false,
  };
}
