import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type {
  AppScreen,
  CameraError,
  CameraFacing,
  CameraStatus,
  ImageAdjustments,
  ReferenceMode,
  Transform,
  UploadedImage,
} from '../types';
import { DEFAULT_ADJUSTMENTS, DEFAULT_TRANSFORM } from '../types';

// ─── App Store ─────────────────────────────────────────────────────────────
// Shared app and reference-image state lives here. Camera feature state stays
// local to useCamera because it belongs to one active MediaStreamTrack.

interface AppState {
  // Navigation
  screen: AppScreen;
  setScreen: (screen: AppScreen) => void;

  // Camera
  cameraStatus: CameraStatus;
  cameraError: CameraError | null;
  cameraFacing: CameraFacing;
  setCameraStatus: (status: CameraStatus, error?: CameraError | null) => void;
  setCameraFacing: (facing: CameraFacing) => void;

  // Uploaded image (null = no image loaded)
  uploadedImage: UploadedImage | null;
  setUploadedImage: (image: UploadedImage | null) => void;
  referenceMode: ReferenceMode;
  setReferenceMode: (mode: ReferenceMode) => void;
  initialFitImageId: string | null;
  markInitialFitImage: (imageId: string) => void;

  // Overlay transform (x/y in px, scale multiplier, rotation in degrees)
  transform: Transform;
  setTransform: (transform: Transform | ((prev: Transform) => Transform)) => void;
  resetTransform: () => void;

  // Image adjustments (CSS-filter-based — all implemented)
  adjustments: ImageAdjustments;
  setAdjustments: (adjustments: Partial<ImageAdjustments>) => void;
  resetAdjustments: () => void;

  // Lock — prevents accidental overlay movement
  isLocked: boolean;
  setLocked: (locked: boolean) => void;
  toggleLocked: () => void;

  // UI panels
  showAdjustPanel: boolean;
  setShowAdjustPanel: (show: boolean) => void;

  // Wake lock status (informational — managed by useWakeLock)
  wakeLockActive: boolean;
  setWakeLockActive: (active: boolean) => void;
}

export const useAppStore = create<AppState>()(
  subscribeWithSelector((set) => ({
    // ─── Navigation ─────────────────────────────────────────────────────
    screen: 'home',
    setScreen: (screen) => set({ screen }),

    // ─── Camera ─────────────────────────────────────────────────────────
    cameraStatus: 'idle',
    cameraError: null,
    cameraFacing: 'environment',
    setCameraStatus: (status, error) =>
      set({ cameraStatus: status, cameraError: error ?? null }),
    setCameraFacing: (facing) => set({ cameraFacing: facing }),

    // ─── Image ──────────────────────────────────────────────────────────
    uploadedImage: null,
    referenceMode: 'normal',
    initialFitImageId: null,
    setUploadedImage: (image) =>
      set({ uploadedImage: image, initialFitImageId: null, referenceMode: 'normal' }),
    setReferenceMode: (mode) => set({ referenceMode: mode }),
    markInitialFitImage: (imageId) => set({ initialFitImageId: imageId }),

    // ─── Transform ──────────────────────────────────────────────────────
    transform: { ...DEFAULT_TRANSFORM },
    setTransform: (transformOrUpdater) =>
      set((state) => ({
        transform:
          typeof transformOrUpdater === 'function'
            ? transformOrUpdater(state.transform)
            : transformOrUpdater,
      })),
    resetTransform: () => set({ transform: { ...DEFAULT_TRANSFORM } }),

    // ─── Adjustments ────────────────────────────────────────────────────
    adjustments: { ...DEFAULT_ADJUSTMENTS },
    setAdjustments: (partial) =>
      set((state) => ({
        adjustments: { ...state.adjustments, ...partial },
      })),
    resetAdjustments: () => set({ adjustments: { ...DEFAULT_ADJUSTMENTS } }),

    // ─── Lock ───────────────────────────────────────────────────────────
    isLocked: false,
    setLocked: (locked) => set({ isLocked: locked }),
    toggleLocked: () => set((s) => ({ isLocked: !s.isLocked })),

    // ─── UI ─────────────────────────────────────────────────────────────
    showAdjustPanel: false,
    setShowAdjustPanel: (show) => set({ showAdjustPanel: show }),

    // ─── Wake Lock ──────────────────────────────────────────────────────
    wakeLockActive: false,
    setWakeLockActive: (active) => set({ wakeLockActive: active }),
  }))
);

