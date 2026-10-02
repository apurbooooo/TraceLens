# TraceLens — Technical Roadmap

> **See it. Trace it. Draw it.**

---

## Rendering Architecture

```
┌─────────────────────────────────────────────────────────┐
│  React UI Layer (Zustand state — NO frame data)         │
│  CameraHeader | OverlayToolbar | AdjustPanel            │
├─────────────────────────────────────────────────────────┤
│  Visual Layer (CSS compositor — NO React re-renders)    │
│  <video srcObject=stream>   ← camera feed (imperative)  │
│  <img src=displayUrl>       ← overlay (CSS transform)   │
└─────────────────────────────────────────────────────────┘
```

### Image memory pipeline

```
File → HTMLImage (decode dimensions only)
     → createImageBitmap(File blob)
     → downscale if > MAX_DISPLAY_SIZE (1920px)
     → OffscreenCanvas.convertToBlob('image/webp')
     → URL.createObjectURL(blob) = displayUrl
     → ImageBitmap.close()  ← GPU memory freed
```

`displayUrl` is what `<img>` renders. `displayWidth × displayHeight` are the ground-truth dimensions for fit calculations.

---

## Phase Status

### ✅ PHASE 0 — Architecture (complete)
- Rendering strategy decided
- State management decided
- Image memory architecture decided

### ✅ PHASE 1 — MVP (complete, stable)
- [x] React + TypeScript + Vite + Tailwind CSS v4
- [x] HTTPS dev server (`@vitejs/plugin-basic-ssl`)
- [x] PWA manifest + service worker + offline shell
- [x] PWA icons (192, 512, apple-touch-icon)
- [x] Mobile-first layout + safe area
- [x] Camera: getUserMedia, rear camera default, front/rear switch
- [x] Camera: AbortController race condition protection
- [x] Camera: permission denied / unavailable / insecure / unsupported errors
- [x] Camera: visibility change handling
- [x] Image upload: mobile-safe bitmap pipeline
- [x] Image upload: GPU memory freed after displayUrl creation
- [x] Auto-fit on image upload
- [x] Overlay: CSS transform (translate, scale, rotate, flip)
- [x] Overlay: CSS filter (opacity, brightness, contrast, saturation, grayscale, invert, blur)
- [x] Gestures: single-finger drag
- [x] Gestures: pinch-zoom
- [x] Gestures: two-finger rotate
- [x] Gestures: touchcancel handling
- [x] Gestures: 2→1 finger transition
- [x] Lock / unlock with visual indicator
- [x] Fit to screen (using display dimensions)
- [x] Reset transform
- [x] Flip H / Flip V
- [x] Screen Wake Lock + visibility re-acquire + unmount cleanup
- [x] Fullscreen API

### 📋 PHASE 2 — Image Processing
- [ ] B&W / Grayscale mode toggle (CSS 100% grayscale shortcut)
- [ ] Ghost mode preset (opacity ~20%, high contrast)
- [ ] High Contrast mode (CSS filter shortcut)
- [ ] Outline / edge detection — requires canvas + Web Worker
- [ ] Threshold slider — requires canvas processing
- [ ] Sharpness control — requires canvas convolution
- [ ] Cached processed ImageBitmap for expensive modes
- [ ] Processing at reduced resolution for performance

### 📋 PHASE 3 — Performance
- [ ] OffscreenCanvas + Web Worker rendering pipeline
- [ ] Adaptive FPS: 30 (default), 60 (high-quality mode)
- [ ] Device capability detection (hardware concurrency, memory)
- [ ] Battery Saver / Balanced / High Quality performance modes
- [ ] Memory pressure handling (large image fallback)
- [ ] Render loop profiling

### 📋 PHASE 4 — PWA + Storage
- [ ] IndexedDB: recent images
- [ ] IndexedDB: user preferences (adjustments, performance mode)
- [ ] IndexedDB: last tracing configuration
- [ ] In-app toast notifications (replace alert())
- [ ] Better PWA install prompt
- [ ] Storage quota handling

### 📋 PHASE 5 — Advanced Tracing
- [ ] Tracing Mode (minimal UI — hide all controls)
- [ ] Grid / guides overlay
- [ ] Camera zoom controls (where MediaStream supports it)
- [ ] Orientation lock (where supported)
- [ ] Better gesture refinements (momentum, snap-to-grid)

### 📋 PHASE 6 — Computer Vision / AR
**Do not start until Phase 1–5 are stable.**
- [ ] Paper / document edge detection (OpenCV.js or MediaPipe)
- [ ] Four-corner detection
- [ ] Perspective transform (map reference to paper quadrilateral)
- [ ] Overlay stabilization against camera movement
- [ ] AR mode toggle (manual vs. tracked)
- [ ] Low-cost fallback when device is too slow for CV

---

## Key Technical Constraints

### What must never happen
- Video frames in React state
- React re-renders during touch move events
- Heavy CV processing on every camera frame
- GPU memory not freed after image upload
- Stale camera stream attaching after unmount

### What must always work
- Clean camera teardown on unmount
- Object URL revocation on image remove/replace
- AbortController cancellation on facing change
- Wake lock release on unmount
- Graceful degradation for unsupported APIs

---

## Build Verification

```bash
npm run build
# Expected: 0 TypeScript errors
# Expected: ~259KB JS / ~20KB CSS
# Expected: PWA service worker generated
```
