import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import type { CameraError } from '../../types';
import {
  applyStabilization,
  applyTorch,
  getStabilizationControl,
  isCameraError,
  parseCameraError,
  startCamera,
  startDigitalStabilization,
  stopCamera,
  supportsDigitalStabilization,
  supportsTorch,
  type StabilizationControl,
} from './cameraUtils';

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const removeTrackListenersRef = useRef<(() => void) | null>(null);
  const torchEnabledRef = useRef(false);
  const torchBusyRef = useRef(false);
  const stabilizerEnabledRef = useRef(false);
  const stabilizerBusyRef = useRef(false);
  const stabilizationControlRef = useRef<StabilizationControl | null>(null);
  const stabilizerModeRef = useRef<'native' | 'digital' | null>(null);
  const digitalStabilizationCleanupRef = useRef<(() => void) | null>(null);
  const stabilizerAttemptRef = useRef<AbortController | null>(null);
  const stabilizerOperationRef = useRef(0);
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [stabilizerSupported, setStabilizerSupported] = useState(false);
  const [stabilizerEnabled, setStabilizerEnabled] = useState(false);
  const [stabilizerBusy, setStabilizerBusy] = useState(false);

  const cameraFacing = useAppStore((state) => state.cameraFacing);
  const setCameraStatus = useAppStore((state) => state.setCameraStatus);

  const turnStabilizerOff = useCallback(() => {
    const activeTrack = streamRef.current?.getVideoTracks()[0];
    const wasNative = stabilizerModeRef.current === 'native';
    stabilizerOperationRef.current += 1;
    stabilizerAttemptRef.current?.abort();
    stabilizerAttemptRef.current = null;
    digitalStabilizationCleanupRef.current?.();
    digitalStabilizationCleanupRef.current = null;
    if (videoRef.current) videoRef.current.style.transform = '';
    if (activeTrack && wasNative && stabilizationControlRef.current) {
      void applyStabilization(activeTrack, stabilizationControlRef.current, false).catch(() => {});
    }
    stabilizerModeRef.current = null;
    stabilizerEnabledRef.current = false;
    stabilizerBusyRef.current = false;
    setStabilizerEnabled(false);
    setStabilizerBusy(false);
  }, [videoRef]);

  const stopCurrentStream = useCallback(() => {
    const activeTrack = streamRef.current?.getVideoTracks()[0];
    if (activeTrack && torchEnabledRef.current) {
      void applyTorch(activeTrack, false).catch(() => {});
    }
    turnStabilizerOff();
    torchEnabledRef.current = false;
    torchBusyRef.current = false;
    stabilizationControlRef.current = null;
    setTorchSupported(false);
    setTorchEnabled(false);
    setTorchBusy(false);
    setStabilizerSupported(false);
    removeTrackListenersRef.current?.();
    removeTrackListenersRef.current = null;
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
  }, [turnStabilizerOff, videoRef]);

  const stopStream = useCallback(() => {
    requestIdRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    stopCurrentStream();
  }, [stopCurrentStream]);

  const startStream = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !mountedRef.current) return;

    const requestId = ++requestIdRef.current;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    stopCurrentStream();
    setCameraStatus('requesting');

    const isCurrent = () =>
      mountedRef.current && requestIdRef.current === requestId && !controller.signal.aborted;

    try {
      const stream = await startCamera(video, cameraFacing, controller.signal);
      if (!isCurrent()) {
        stopCamera(stream, video);
        return;
      }

      streamRef.current = stream;
      abortControllerRef.current = null;
      const videoTracks = stream.getVideoTracks();
      const activeTrack = videoTracks[0] ?? null;
      const hasTorch = cameraFacing === 'environment' && supportsTorch(activeTrack);
      stabilizationControlRef.current = getStabilizationControl(activeTrack);
      setTorchSupported(hasTorch);
      setTorchEnabled(false);
      torchEnabledRef.current = false;
      setStabilizerSupported(
        stabilizationControlRef.current !== null || supportsDigitalStabilization()
      );
      setStabilizerEnabled(false);
      stabilizerEnabledRef.current = false;
      const onTrackEnded = () => {
        if (
          !isCurrent() ||
          streamRef.current !== stream ||
          videoTracks.some((track) => track.readyState === 'live')
        ) {
          return;
        }

        stopStream();
        setCameraStatus('error', {
          type: 'unavailable',
          message: 'The camera stream ended. Restart the camera to continue.',
        });
      };
      videoTracks.forEach((track) => track.addEventListener('ended', onTrackEnded));
      removeTrackListenersRef.current = () => {
        videoTracks.forEach((track) => track.removeEventListener('ended', onTrackEnded));
      };
      setCameraStatus('active');
    } catch (error) {
      if (!isCurrent()) return;
      abortControllerRef.current = null;
      if (error instanceof DOMException && error.name === 'AbortError') return;

      const cameraError: CameraError = isCameraError(error) ? error : parseCameraError(error);
      setCameraStatus('error', cameraError);
    }
  }, [cameraFacing, setCameraStatus, stopCurrentStream, stopStream, videoRef]);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchSupported || torchBusyRef.current) return;

    const nextEnabled = !torchEnabledRef.current;
    torchBusyRef.current = true;
    setTorchBusy(true);
    try {
      await applyTorch(track, nextEnabled);
      if (streamRef.current?.getVideoTracks()[0] === track) {
        torchEnabledRef.current = nextEnabled;
        setTorchEnabled(nextEnabled);
      }
    } catch {
      if (streamRef.current?.getVideoTracks()[0] === track) {
        torchEnabledRef.current = false;
        setTorchEnabled(false);
        setTorchSupported(false);
      }
    } finally {
      torchBusyRef.current = false;
      setTorchBusy(false);
    }
  }, [torchSupported]);

  const toggleStabilizer = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    const video = videoRef.current;
    const control = stabilizationControlRef.current;
    if (!track || !video || !stabilizerSupported || stabilizerBusyRef.current) return;

    const nextEnabled = !stabilizerEnabledRef.current;
    const operation = ++stabilizerOperationRef.current;
    stabilizerBusyRef.current = true;
    setStabilizerBusy(true);

    const isCurrentOperation = () =>
      stabilizerOperationRef.current === operation &&
      streamRef.current?.getVideoTracks()[0] === track;

    try {
      if (!nextEnabled) {
        if (stabilizerModeRef.current === 'native' && control) {
          try {
            await applyStabilization(track, control, false);
          } catch {
            if (isCurrentOperation()) setStabilizerSupported(false);
          }
        }
        if (!isCurrentOperation()) return;
        digitalStabilizationCleanupRef.current?.();
        digitalStabilizationCleanupRef.current = null;
        if (videoRef.current) videoRef.current.style.transform = '';
        stabilizerModeRef.current = null;
        stabilizerEnabledRef.current = false;
        setStabilizerEnabled(false);
        return;
      }

      if (control) {
        try {
          await applyStabilization(track, control, true);
          if (!isCurrentOperation()) {
            void applyStabilization(track, control, false).catch(() => {});
            return;
          }
          stabilizerModeRef.current = 'native';
          stabilizerEnabledRef.current = true;
          setStabilizerEnabled(true);
          return;
        } catch {
          // A reported control can still reject applyConstraints. Try motion fallback.
          void applyStabilization(track, control, false).catch(() => {});
        }
      }

      const attempt = new AbortController();
      stabilizerAttemptRef.current = attempt;
      const cleanup = await startDigitalStabilization(video, attempt.signal);
      if (!isCurrentOperation() || attempt.signal.aborted) {
        cleanup();
        return;
      }
      stabilizerAttemptRef.current = null;
      digitalStabilizationCleanupRef.current = cleanup;
      stabilizerModeRef.current = 'digital';
      stabilizerEnabledRef.current = true;
      setStabilizerEnabled(true);
    } catch (error) {
      if (isCurrentOperation() && !(error instanceof DOMException && error.name === 'AbortError')) {
        digitalStabilizationCleanupRef.current?.();
        digitalStabilizationCleanupRef.current = null;
        stabilizerModeRef.current = null;
        stabilizerEnabledRef.current = false;
        setStabilizerEnabled(false);
        setStabilizerSupported(false);
      }
    } finally {
      if (stabilizerOperationRef.current === operation) {
        stabilizerAttemptRef.current = null;
        stabilizerBusyRef.current = false;
        setStabilizerBusy(false);
      }
    }
  }, [stabilizerSupported, videoRef]);

  const turnTorchOff = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track || !torchEnabledRef.current) return;
    try {
      await applyTorch(track, false);
    } catch {
      // Stopping or switching the camera track still releases the physical torch.
    } finally {
      torchEnabledRef.current = false;
      setTorchEnabled(false);
    }
  }, []);

  // Delaying the first request to the next task lets StrictMode's effect
  // cleanup cancel its probe before it opens a real camera request.
  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    const startupId = setTimeout(() => {
      if (active) void startStream();
    }, 0);

    return () => {
      active = false;
      clearTimeout(startupId);
      mountedRef.current = false;
      stopStream();
      setCameraStatus('idle');
    };
  }, [setCameraStatus, startStream, stopStream]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void turnTorchOff();
        turnStabilizerOff();
        streamRef.current?.getVideoTracks().forEach((track) => {
          if (track.readyState === 'live') track.enabled = false;
        });
        if (mountedRef.current && streamRef.current) setCameraStatus('paused');
        return;
      }

      const stream = streamRef.current;
      const liveTracks = stream?.getVideoTracks().filter((track) => track.readyState === 'live') ?? [];
      if (stream && liveTracks.length > 0) {
        liveTracks.forEach((track) => { track.enabled = true; });
        if (mountedRef.current) setCameraStatus('active');
      } else if (mountedRef.current) {
        void startStream();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [setCameraStatus, startStream, turnStabilizerOff, turnTorchOff]);

  return {
    restart: startStream,
    stop: stopStream,
    streamRef,
    torchSupported,
    torchEnabled,
    torchBusy,
    toggleTorch,
    stabilizerSupported,
    stabilizerEnabled,
    stabilizerBusy,
    toggleStabilizer,
  };
}
