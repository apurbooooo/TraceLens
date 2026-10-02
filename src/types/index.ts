// ─── Image Transform State ─────────────────────────────────────────────────

export interface Transform {
  x: number;        // px offset from center
  y: number;        // px offset from center
  scale: number;    // 1.0 = image renders at its intrinsic display size
  rotation: number; // degrees
  flipH: boolean;
  flipV: boolean;
}

export const DEFAULT_TRANSFORM: Transform = {
  x: 0,
  y: 0,
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
};

// ─── Image Appearance Adjustments ──────────────────────────────────────────

export interface ImageAdjustments {
  opacity: number;      // 0–100
  brightness: number;   // 0–200 (100 = normal)
  contrast: number;     // 0–200 (100 = normal)
  saturation: number;   // 0–200 (100 = normal)
  // sharpness: Phase 2 — canvas-based, not yet implemented
  blur: number;         // 0–20 px (CSS blur)
  grayscale: number;    // 0–100 (CSS grayscale)
  invert: number;       // 0–100 (CSS invert)
}

export const DEFAULT_ADJUSTMENTS: ImageAdjustments = {
  opacity: 50,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  grayscale: 0,
  invert: 0,
};

// ─── Uploaded Image ────────────────────────────────────────────────────────

export interface UploadedImage {
  id: string;
  /**
   * Object URL for the DISPLAY bitmap (downscaled to MAX_DISPLAY_SIZE).
   * This is what <img> renders. Revoke on cleanup.
   */
  displayUrl: string;
  /**
   * Intrinsic pixel dimensions of the display bitmap.
   * Used for fit-to-screen calculations — must match what <img> actually renders.
   */
  displayWidth: number;
  displayHeight: number;
  /** Natural dimensions of the original image — kept for metadata/future use */
  naturalWidth: number;
  naturalHeight: number;
}

// ─── Camera State ──────────────────────────────────────────────────────────

export type CameraFacing = 'environment' | 'user';

export type ReferenceMode = 'normal' | 'bw' | 'sketch';

export type CameraStatus =
  | 'idle'
  | 'requesting'
  | 'active'
  | 'paused'
  | 'error';

export interface CameraError {
  type: 'permission' | 'unavailable' | 'unsupported' | 'insecure' | 'constraint' | 'unknown';
  message: string;
}

// ─── App State ─────────────────────────────────────────────────────────────

export type AppScreen = 'home' | 'camera';

// PerformanceMode: Phase 3 — adaptive FPS / quality scaling, not yet implemented
export type PerformanceMode = 'battery' | 'balanced' | 'quality';

// TracingMode remains a future preset type; reference appearance modes are
// represented by ReferenceMode so they stay independent from image adjustments.
export type TracingMode = 'photo';

