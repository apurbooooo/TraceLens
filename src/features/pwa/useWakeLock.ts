import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../app/store';

type WakeLockApi = { request(type: 'screen'): Promise<WakeLockSentinel> };

export function useWakeLock() {
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const pendingRequestRef = useRef<number | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const wantLockRef = useRef(false);
  const setWakeLockActive = useAppStore((state) => state.setWakeLockActive);

  const request = useCallback(async function requestLock() {
    if (!('wakeLock' in navigator)) return;

    wantLockRef.current = true;
    if (wakeLockRef.current || pendingRequestRef.current !== null) return;

    const requestId = ++requestIdRef.current;
    pendingRequestRef.current = requestId;
    try {
      const api = (navigator as Navigator & { wakeLock: WakeLockApi }).wakeLock;
      const sentinel = await api.request('screen');

      if (
        !mountedRef.current ||
        !wantLockRef.current ||
        requestIdRef.current !== requestId ||
        document.visibilityState !== 'visible'
      ) {
        await sentinel.release().catch(() => {});
        if (pendingRequestRef.current === requestId) pendingRequestRef.current = null;
        if (
          mountedRef.current &&
          wantLockRef.current &&
          document.visibilityState === 'visible'
        ) {
          void requestLock();
        }
        return;
      }

      if (pendingRequestRef.current === requestId) pendingRequestRef.current = null;
      wakeLockRef.current = sentinel;
      const onRelease = () => {
        if (wakeLockRef.current !== sentinel) return;
        wakeLockRef.current = null;
        setWakeLockActive(false);
        // The OS may release it; visibility changes can retry if it is wanted.
      };
      sentinel.addEventListener('release', onRelease, { once: true });
      if (sentinel.released) onRelease();
      else setWakeLockActive(true);
    } catch {
      if (pendingRequestRef.current === requestId) pendingRequestRef.current = null;
      if (requestIdRef.current === requestId) {
        setWakeLockActive(false);
      } else if (
        mountedRef.current &&
        wantLockRef.current &&
        document.visibilityState === 'visible'
      ) {
        void requestLock();
      }
    }
  }, [setWakeLockActive]);

  const release = useCallback(async () => {
    wantLockRef.current = false;
    requestIdRef.current += 1;

    const sentinel = wakeLockRef.current;
    wakeLockRef.current = null;
    setWakeLockActive(false);
    if (sentinel && !sentinel.released) {
      await sentinel.release().catch(() => {});
    }
  }, [setWakeLockActive]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      wantLockRef.current = false;
      requestIdRef.current += 1;

      const sentinel = wakeLockRef.current;
      wakeLockRef.current = null;
      if (sentinel && !sentinel.released) sentinel.release().catch(() => {});
      setWakeLockActive(false);
    };
  }, [setWakeLockActive]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (
        document.visibilityState === 'visible' &&
        wantLockRef.current &&
        !wakeLockRef.current &&
        pendingRequestRef.current === null
      ) {
        void request();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [request]);

  return { requestWakeLock: request, releaseWakeLock: release };
}
