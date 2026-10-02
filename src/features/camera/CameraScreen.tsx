import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import { useCamera } from './useCamera';
import { useWakeLock } from '../pwa/useWakeLock';
import { CameraErrorView } from './CameraErrorView';
import { CameraHeader } from './CameraHeader';
import { OverlayImage } from '../overlay/OverlayImage';
import { OverlayToolbar } from '../overlay/OverlayToolbar';
import { AdjustPanel } from '../adjustments/AdjustPanel';
import { computeInitialFitTransform } from '../../lib/imageUtils';

/**
 * CameraScreen — the primary user experience.
 *
 * Layout:
 *  ┌─────────────────────────────┐
 *  │ CameraHeader                │  glass top bar
 *  ├─────────────────────────────┤
 *  │                             │
 *  │  <video> (camera feed)      │  fills remaining space
 *  │  <OverlayImage> (on top)    │
 *  │                             │
 *  ├─────────────────────────────┤
 *  │ OverlayToolbar              │  glass bottom bar
 *  └─────────────────────────────┘
 *
 * Fix #3: Auto-applies an initial fit transform when a new image is loaded
 *         and the container size is already known.
 * Fix #5: Wake lock is released on unmount via useWakeLock's cleanup effect.
 */
export const CameraScreen: React.FC = () => {
  const cameraStatus = useAppStore((s) => s.cameraStatus);
  const cameraError = useAppStore((s) => s.cameraError);
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const setTransform = useAppStore((s) => s.setTransform);
  const initialFitImageId = useAppStore((s) => s.initialFitImageId);
  const markInitialFitImage = useAppStore((s) => s.markInitialFitImage);
  const isLocked = useAppStore((s) => s.isLocked);

  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const { restart } = useCamera(videoRef);
  const { requestWakeLock, releaseWakeLock } = useWakeLock();
  const fullscreenSupported =
    typeof document !== 'undefined' &&
    typeof document.documentElement.requestFullscreen === 'function' &&
    typeof document.exitFullscreen === 'function';

  // ─── Container size tracking ──────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // ─── Wake lock — tied to camera active state ──────────────────────────────
  useEffect(() => {
    if (cameraStatus === 'active') {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  }, [cameraStatus, requestWakeLock, releaseWakeLock]);

  // ─── Auto-fit on image upload (#3) ───────────────────────────────────────
  useEffect(() => {
    if (!uploadedImage) return;
    if (isLocked) return;
    if (uploadedImage.id === initialFitImageId) return;

    // If container size is not yet known, defer until it is
    if (containerSize.width === 0 || containerSize.height === 0) return;

    const initialTransform = computeInitialFitTransform(
      uploadedImage.displayWidth,
      uploadedImage.displayHeight,
      containerSize.width,
      containerSize.height
    );
    setTransform(initialTransform);
    markInitialFitImage(uploadedImage.id);
  }, [uploadedImage, containerSize, initialFitImageId, isLocked, markInitialFitImage, setTransform]);

  // ─── Fullscreen ───────────────────────────────────────────────────────────
  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported) return;
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      } catch {
        alert('The browser blocked fullscreen mode.');
      }
    } else {
      try {
        await document.exitFullscreen();
      } catch {
        alert('The browser could not exit fullscreen mode.');
      }
    }
  }, [fullscreenSupported]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // ─── Retry after error ────────────────────────────────────────────────────
  const handleRetry = useCallback(() => {
    void restart();
  }, [restart]);

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100svh', background: '#000' }}
    >
      {/* Header */}
      <CameraHeader
        isFullscreen={isFullscreen}
        fullscreenSupported={fullscreenSupported}
        onToggleFullscreen={toggleFullscreen}
      />

      {/* Camera viewport */}
      <div
        ref={containerRef}
        className="relative flex-1 overflow-hidden"
        style={{ background: '#000' }}
      >
        {/* Loading */}
        {cameraStatus === 'requesting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 z-10">
            <div className="spinner" />
            <span className="text-sm" style={{ color: 'rgba(240,240,240,0.5)' }}>
              Starting camera…
            </span>
          </div>
        )}

        {/* Error */}
        {cameraStatus === 'error' && cameraError && (
          <div
            className="absolute inset-0 z-10 overflow-y-auto"
            style={{ background: '#0a0a0a' }}
          >
            <CameraErrorView error={cameraError} onRetry={handleRetry} />
          </div>
        )}

        {/* Camera video — always in DOM so videoRef is stable */}
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="absolute inset-0 w-full h-full"
          style={{
            objectFit: 'cover',
            opacity: cameraStatus === 'active' || cameraStatus === 'paused' ? 1 : 0,
            transition: 'opacity 0.3s ease',
          }}
          aria-label="Camera feed"
        />

        {/* Reference overlay */}
        <OverlayImage />

        {/* Paused badge */}
        {cameraStatus === 'paused' && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full
                        text-xs font-medium z-10"
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: 'rgba(240,240,240,0.7)',
              backdropFilter: 'blur(8px)',
            }}
          >
            Paused
          </div>
        )}
      </div>

      {/* Toolbar */}
      <OverlayToolbar
        containerWidth={containerSize.width}
        containerHeight={containerSize.height}
      />

      {/* Adjustment panel */}
      <AdjustPanel />
    </div>
  );
};
