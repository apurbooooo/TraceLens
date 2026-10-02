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
  stopCamera,
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
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [stabilizerSupported, setStabilizerSupported] = useState(false);
  const [stabilizerEnabled, setStabilizerEnabled] = useState(false);
  const [stabilizerBusy, setStabilizerBusy] = useState(false);

  const cameraFacing = useAppStore((state) => state.cameraFacing);
  const setCameraStatus = useAppStore((state) => state.setCameraStatus);

  const stopCurrentStream = useCallback(() => {
    const activeTrack = streamRef.current?.getVideoTracks()[0];
    if (activeTrack && torchEnabledRef.current) {
      void applyTorch(activeTrack, false).catch(() => {});
    }
    if (activeTrack && stabilizerEnabledRef.current && stabilizationControlRef.current) {
      void applyStabilization(activeTrack, stabilizationControlRef.current, false).catch(() => {});
    }
    torchEnabledRef.current = false;
    torchBusyRef.current = false;
    stabilizerEnabledRef.current = false;
    stabilizerBusyRef.current = false;
    stabilizationControlRef.current = null;
    setTorchSupported(false);
    setTorchEnabled(false);
    setTorchBusy(false);
    setStabilizerSupported(false);
    setStabilizerEnabled(false);
    setStabilizerBusy(false);
    removeTrackListenersRef.current?.();
    removeTrackListenersRef.current = null;
    stopCamera(streamRef.current, videoRef.current);
    streamRef.current = null;
  }, [videoRef]);

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
      setStabilizerSupported(stabilizationControlRef.current !== null);
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
    const control = stabilizationControlRef.current;
    if (!track || !control || !stabilizerSupported || stabilizerBusyRef.current) return;

    const nextEnabled = !stabilizerEnabledRef.current;
    stabilizerBusyRef.current = true;
    setStabilizerBusy(true);
    try {
      await applyStabilization(track, control, nextEnabled);
      if (streamRef.current?.getVideoTracks()[0] === track) {
        stabilizerEnabledRef.current = nextEnabled;
        setStabilizerEnabled(nextEnabled);
      }
    } catch {
      if (streamRef.current?.getVideoTracks()[0] === track) {
        stabilizerEnabledRef.current = false;
        setStabilizerEnabled(false);
        setStabilizerSupported(false);
      }
    } finally {
      stabilizerBusyRef.current = false;
      setStabilizerBusy(false);
    }
  }, [stabilizerSupported]);

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
  }, [setCameraStatus, startStream, turnTorchOff]);

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
