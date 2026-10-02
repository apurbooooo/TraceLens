import React, { memo } from 'react';
import { useAppStore } from '../../app/store';
import { useGestures } from '../gestures/useGestures';
import { buildCssFilter, buildCssTransform } from '../../lib/imageUtils';
import { useSketchImage } from '../image-processing/useSketchImage';

/**
 * OverlayImage — reference image composited over the camera feed.
 *
 * Architecture:
 * - Renders uploadedImage.displayUrl (the downscaled, mobile-safe bitmap URL)
 * - CSS transforms handle all positioning — GPU compositor layer
 * - CSS filters handle all appearance adjustments — no canvas per frame
 * - Gesture capture div sits above the image in z-order
 * - Lock state: gesture div gets pointer-events:none, amber border appears
 *
 * Performance:
 * - memo() — only re-renders when store values actually change
 * - will-change: transform — GPU promotes this element to its own layer
 * - No canvas, no requestAnimationFrame, no worker needed for Phase 1
 */
export const OverlayImage: React.FC = memo(() => {
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const transform = useAppStore((s) => s.transform);
  const adjustments = useAppStore((s) => s.adjustments);
  const isLocked = useAppStore((s) => s.isLocked);
  const referenceMode = useAppStore((s) => s.referenceMode);
  const { sketchUrl, sketchStatus } = useSketchImage(uploadedImage, referenceMode === 'sketch');

  const { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel } = useGestures();

  if (!uploadedImage) return null;

  const cssTransform = buildCssTransform(transform);
  const usingSketch = referenceMode === 'sketch' && !!sketchUrl;
  const cssFilter = buildCssFilter(
    adjustments,
    referenceMode === 'bw' || (referenceMode === 'sketch' && !sketchUrl)
  );
  const opacity = adjustments.opacity / 100;
  const displayUrl = usingSketch && sketchUrl ? sketchUrl : uploadedImage.displayUrl;

  return (
    <div
      className="absolute inset-0 flex items-center justify-center"
      aria-hidden="true"
      style={{ pointerEvents: 'none' }}
    >
      <span className="sr-only" role="status" aria-live="polite">
        {referenceMode === 'sketch' && sketchStatus === 'processing' ? 'Preparing reference sketch.' : ''}
        {referenceMode === 'sketch' && sketchStatus === 'error'
          ? 'Sketch mode is unavailable. The original reference image is still visible.'
          : ''}
      </span>
      {/* Gesture capture layer — full-screen, above the image */}
      <div
        className="absolute inset-0"
        style={{
          pointerEvents: isLocked ? 'none' : 'auto',
          touchAction: 'none',
          zIndex: 1,
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchCancel}
      />

      {/*
        Reference image.
        - src: displayUrl (downscaled, memory-safe bitmap URL)
        - width/height not set — browser renders at natural size of the blob,
          which IS displayWidth × displayHeight. CSS scale controls visual size.
        - pointer-events: none — gestures are captured by the div above
      */}
      <img
        src={displayUrl}
        alt="Tracing reference"
        draggable={false}
        style={{
          position: 'absolute',
          // Do not constrain with maxWidth/maxHeight — we control size via CSS scale
          maxWidth: 'none',
          maxHeight: 'none',
          opacity,
          transform: cssTransform,
          filter: cssFilter,
          transition: 'filter 160ms ease',
          willChange: 'transform, opacity, filter',
          transformOrigin: 'center center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Lock indicator — amber inset border */}
      {isLocked && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            boxShadow: 'inset 0 0 0 2px rgba(245, 158, 11, 0.55)',
            zIndex: 2,
          }}
        />
      )}
    </div>
  );
});

OverlayImage.displayName = 'OverlayImage';
