# TraceLens

**See it. Trace it. Draw it.**

A mobile-first camera tracing / reference overlay app for iPhone and Android browsers.

---

## What it does

Open TraceLens on your phone, upload any reference image, grant camera access, and see your image as a transparent overlay on the live camera feed. Place a sheet of paper under your phone, align the reference image, lock it in place, and trace directly on the paper while looking through the phone.

---

## Getting Started

```bash
# Install dependencies
npm install

# Start dev server (accessible on local network for phone testing)
npm run dev:host

# Production build
npm run build

# Preview production build
npm run preview

# Regenerate PWA icons
npm run icons
```

**Phone testing**: open `https://192.168.1.100:5174` (note HTTPS — required for camera)

> First visit will show a certificate warning. Tap **"Show Details" → "visit this website" → "Visit Website"** (Safari) or **"Advanced" → "Proceed"** (Chrome).

---

## Tech Stack

| Technology | Purpose |
|---|---|
| React 19 + TypeScript 6 | UI framework |
| Vite 8 | Build tool + dev server |
| Tailwind CSS v4 | Styling |
| Zustand 5 | Global state (non-rendering only) |
| vite-plugin-pwa | PWA / service worker |
| @vitejs/plugin-basic-ssl | HTTPS for local dev |
| Lucide React | Icons |

**Browser APIs used**: `getUserMedia`, Screen Wake Lock, Fullscreen API, ResizeObserver, OffscreenCanvas, `createImageBitmap`

---

## Architecture

### Camera rendering is IMPERATIVE — not React state

```
<video>  ← srcObject = MediaStream (direct, no React state)
  ↓
CSS compositing
  ↓
<img displayUrl>  ← CSS transform + CSS filter (GPU compositor)
```

Video frames **never enter React state**. React manages only: navigation, camera status, image metadata, transform values, adjustment values, lock state.

### Image memory architecture

```
File → createImageBitmap() → downscale if > 1920px
     → draw to OffscreenCanvas → convertToBlob()
     → URL.createObjectURL(blob) → displayUrl
     → bitmap.close()  ← GPU memory freed immediately
```

The `<img>` renders `displayUrl` (a blob URL). `displayWidth`/`displayHeight` are the actual pixel dimensions of what is rendered — these are used for fit-to-screen calculations, ensuring accuracy.

The original `File` is kept for future export/reprocessing but never rendered directly.

### State management

- **Zustand store**: navigation, camera, image metadata, transform, adjustments, lock, UI panels, wake lock indicator
- **useRef**: video element, container size, gesture snapshots, abort controllers, wake lock sentinel
- **CSS only**: all visual transforms (translate, scale, rotate, flip) and filters (brightness, contrast, etc.)

---

## Features (Phase 1 — Implemented)

| Feature | Status |
|---|---|
| Mobile-first layout with safe area (notch, Dynamic Island) | ✅ |
| Rear camera by default, front/rear switch | ✅ |
| Camera permission/error handling (permission, unavailable, insecure, unsupported, unknown) | ✅ |
| HTTPS dev server for camera access on phones | ✅ |
| Image upload (JPG, PNG, WebP, any browser-decodable format) | ✅ |
| Mobile-safe image processing (max 1920px display, GPU memory freed after upload) | ✅ |
| Reference overlay on camera with opacity control | ✅ |
| Single-finger drag | ✅ |
| Pinch-to-zoom | ✅ |
| Two-finger rotation | ✅ |
| touchcancel handling (prevents stale gesture state) | ✅ |
| Flip horizontal / Flip vertical | ✅ |
| Fit to screen (uses display dimensions — accurate for all aspect ratios) | ✅ |
| Auto-fit on image upload (no manual "Fit" press needed) | ✅ |
| Reset transform | ✅ |
| Lock / Unlock (amber border indicator) | ✅ |
| Image adjustments: opacity, brightness, contrast, saturation, grayscale, invert, blur | ✅ |
| Screen Wake Lock (keeps screen on while tracing) | ✅ |
| Fullscreen mode | ✅ |
| Camera lifecycle: AbortController prevents stale streams on unmount | ✅ |
| Camera lifecycle: visibility change (screen off → re-enable tracks) | ✅ |
| PWA: installable, service worker, offline shell | ✅ |

---

## Not Yet Implemented (Phase 2+)

| Feature | Phase |
|---|---|
| B&W / outline / edge detection modes | Phase 2 |
| Canvas-based image processing | Phase 2 |
| Web Worker for processing | Phase 2 |
| Threshold slider | Phase 2 |
| Sharpness control | Phase 2 |
| Adaptive FPS (30/60) | Phase 3 |
| Device capability detection | Phase 3 |
| Battery Saver / Balanced / High Quality modes | Phase 3 |
| IndexedDB for recent images + settings | Phase 4 |
| Paper/document detection | Phase 6 |
| Perspective transform / AR stabilization | Phase 6 |

---

## Phone Testing

```bash
npm run dev:host
# Server: https://192.168.1.100:5174
```

1. Connect phone to same Wi-Fi as dev machine
2. Open `https://192.168.1.100:5174` in Safari (iOS) or Chrome (Android)
3. Accept the self-signed certificate warning
4. Allow camera access when prompted
5. Upload a reference image → it auto-fits and navigates to camera
6. Use pinch/drag gestures to fine-tune position
7. Tap **Lock** to fix position and start tracing

---

## Verification

```bash
npm run build    # TypeScript check + production build
```

Expected output: zero errors, ~259KB JS gzipped to ~81KB.
