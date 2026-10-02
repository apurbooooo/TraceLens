import { useCallback, useEffect, useRef } from 'react';
import { useAppStore } from '../../app/store';
import type { CameraError } from '../../types';
import { isCameraError, parseCameraError, startCamera, stopCamera } from './cameraUtils';

export function useCamera(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const streamRef = useRef<MediaStream | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(false);
  const removeTrackListenersRef = useRef<(() => void) | null>(null);

  const cameraFacing = useAppStore((state) => state.cameraFacing);
  const setCameraStatus = useAppStore((state) => state.setCameraStatus);

  const stopCurrentStream = useCallback(() => {
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
  }, [setCameraStatus, startStream]);

  return { restart: startStream, stop: stopStream, streamRef };
}
