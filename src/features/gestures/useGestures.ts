import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../app/store';
import {
  getTouchAngle,
  getTouchDistance,
  getTouchMidpoint,
  clamp,
} from '../../lib/imageUtils';
import type { Transform } from '../../types';

const MIN_SCALE = 0.05;
const MAX_SCALE = 10;

/**
 * useGestures — single-finger drag, pinch-zoom, two-finger rotation.
 *
 * Fixes vs original:
 * - touchcancel is handled (clears gesture state cleanly)
 * - Transition from 2→1 fingers resets initial correctly
 * - Lock state is checked reactively in the handlers
 * - No stale gesture state possible after cancel/end
 *
 * Design: capture initial state at touchstart, compute delta on move.
 * This avoids accumulation drift and handles finger transitions cleanly.
 */
export function useGestures() {
  const isLocked = useAppStore((s) => s.isLocked);
  const setTransform = useAppStore((s) => s.setTransform);

  // Snapshot of state at gesture start
  const initial = useRef<{
    transform: Transform;
    distance: number;
    angle: number;
    midpoint: { x: number; y: number };
    touchCount: number;
  } | null>(null);

  // Mirror of current transform for reading inside event handlers
  // without causing re-renders
  const currentTransform = useRef<Transform>(useAppStore.getState().transform);
  const pendingTransform = useRef<Transform | null>(null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = useAppStore.subscribe(
      (s) => s.transform,
      (t) => { currentTransform.current = t; }
    );
    return unsubscribe;
  }, []);

  const flushTransform = useCallback(() => {
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }
    const nextTransform = pendingTransform.current;
    pendingTransform.current = null;
    if (nextTransform) setTransform(nextTransform);
  }, [setTransform]);

  const queueTransform = useCallback((transform: Transform) => {
    pendingTransform.current = transform;
    if (frameRef.current !== null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      const nextTransform = pendingTransform.current;
      pendingTransform.current = null;
      if (nextTransform) setTransform(nextTransform);
    });
  }, [setTransform]);

  useEffect(() => () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
  }, []);

  /** Capture gesture start state */
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (isLocked) return;
      e.preventDefault();
      flushTransform();

      const touches = e.touches;
      const touchCount = touches.length;

      if (touchCount === 1) {
        initial.current = {
          transform: { ...currentTransform.current },
          distance: 0,
          angle: 0,
          midpoint: { x: touches[0].clientX, y: touches[0].clientY },
          touchCount: 1,
        };
      } else if (touchCount >= 2) {
        initial.current = {
          transform: { ...currentTransform.current },
          distance: getTouchDistance(touches),
          angle: getTouchAngle(touches),
          midpoint: getTouchMidpoint(touches),
          touchCount,
        };
      }
    },
    [flushTransform, isLocked]
  );

  /** Apply delta from initial snapshot */
  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (isLocked || !initial.current) return;
      e.preventDefault();

      const touches = e.touches;
      const init = initial.current;

      if (touches.length === 1 && init.touchCount === 1) {
        // ─── Single-finger drag ────────────────────────────────────────
        const dx = touches[0].clientX - init.midpoint.x;
        const dy = touches[0].clientY - init.midpoint.y;
        queueTransform({
          ...init.transform,
          x: init.transform.x + dx,
          y: init.transform.y + dy,
        });
      } else if (touches.length >= 2 && init.touchCount >= 2) {
        // ─── Two-finger pinch + rotate ─────────────────────────────────
        const currentDistance = getTouchDistance(touches);
        const currentAngle = getTouchAngle(touches);
        const currentMid = getTouchMidpoint(touches);

        const scaleFactor = init.distance > 0 ? currentDistance / init.distance : 1;
        const rawAngleDelta = currentAngle - init.angle;
        const deltaAngle = ((rawAngleDelta + 180 + 360) % 360) - 180;
        const dx = currentMid.x - init.midpoint.x;
        const dy = currentMid.y - init.midpoint.y;

        queueTransform({
          ...init.transform,
          scale: clamp(init.transform.scale * scaleFactor, MIN_SCALE, MAX_SCALE),
          rotation: init.transform.rotation + deltaAngle,
          x: init.transform.x + dx,
          y: init.transform.y + dy,
        });
      }
    },
    [isLocked, queueTransform]
  );

  /** Finger lifted — handle 2→1 transition or full end */
  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      // All fingers lifted
      flushTransform();
      initial.current = null;
    } else if (e.touches.length === 1) {
      // Went from 2+ fingers to 1 — reset initial for single-drag continuation
      flushTransform();
      initial.current = {
        transform: { ...currentTransform.current },
        distance: 0,
        angle: 0,
        midpoint: { x: e.touches[0].clientX, y: e.touches[0].clientY },
        touchCount: 1,
      };
    }
  }, [flushTransform]);

  /**
   * touchcancel — browser cancelled the gesture (e.g., notification,
   * incoming call, palm rejection). Clear all state cleanly.
   */
  const onTouchCancel = useCallback(() => {
    flushTransform();
    initial.current = null;
  }, [flushTransform]);

  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel };
}
