import type { CameraError, CameraFacing } from '../../types';

/** Maximum dimension of the retained tracing image. */
export const MAX_DISPLAY_SIZE = 1920;

/** Start and attach a stream. This function owns it until it resolves. */
export async function startCamera(
  videoElement: HTMLVideoElement,
  facing: CameraFacing,
  signal: AbortSignal
): Promise<MediaStream> {
  if (!isSecureContext) {
    throw buildCameraError(
      'insecure',
      'Camera requires a secure connection (HTTPS). Please open the app over HTTPS.'
    );
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    throw buildCameraError(
      'unsupported',
      'Camera API is not supported in this browser. Try Chrome or Safari.'
    );
  }

  const constraints: MediaStreamConstraints = {
    video: {
      facingMode: { ideal: facing },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
    audio: false,
  };

  let stream: MediaStream | null = null;
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (firstError) {
      if (signal.aborted) throw makeAbortError();
      if (isOverconstrainedError(firstError)) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        } catch (fallbackError) {
          throw parseCameraError(fallbackError);
        }
      } else {
        throw parseCameraError(firstError);
      }
    }

    if (signal.aborted) throw makeAbortError();

    videoElement.srcObject = stream;
    videoElement.setAttribute('playsinline', 'true');
    videoElement.muted = true;

    await waitForMetadata(videoElement, signal);
    if (signal.aborted) throw makeAbortError();

    await waitForPlay(videoElement, stream, signal);
    if (signal.aborted) throw makeAbortError();

    return stream;
  } catch (error) {
    // Until the promise resolves, every acquired stream is locally owned here.
    if (stream) stopCamera(stream, videoElement);
    throw error;
  }
}

function makeAbortError(): DOMException {
  return new DOMException('Camera start aborted', 'AbortError');
}

function isOverconstrainedError(error: unknown): boolean {
  return (
    (typeof OverconstrainedError !== 'undefined' && error instanceof OverconstrainedError) ||
    (error instanceof DOMException && error.name === 'OverconstrainedError')
  );
}

function waitForMetadata(video: HTMLVideoElement, signal: AbortSignal): Promise<void> {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadata);
      video.removeEventListener('error', onError);
      signal.removeEventListener('abort', onAbort);
    };
    const onMetadata = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error('Video element failed to load stream'));
    };
    const onAbort = () => {
      cleanup();
      reject(makeAbortError());
    };

    video.addEventListener('loadedmetadata', onMetadata, { once: true });
    video.addEventListener('error', onError, { once: true });
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

function waitForPlay(
  video: HTMLVideoElement,
  stream: MediaStream,
  signal: AbortSignal
): Promise<void> {
  if (signal.aborted) return Promise.reject(makeAbortError());

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const onAbort = () => {
      cleanup();
      stopCamera(stream, video);
      reject(makeAbortError());
    };

    signal.addEventListener('abort', onAbort, { once: true });
    let playPromise: Promise<void>;
    try {
      playPromise = video.play();
    } catch (error) {
      cleanup();
      reject(error);
      return;
    }

    Promise.resolve(playPromise).then(
      () => {
        cleanup();
        resolve();
      },
      (error: unknown) => {
        cleanup();
        reject(error);
      }
    );
    if (signal.aborted) onAbort();
  });
}

/** Stop a stream and detach it only if it is still the element's stream. */
export function stopCamera(
  stream: MediaStream | null,
  videoElement?: HTMLVideoElement | null
): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  if (videoElement?.srcObject === stream) videoElement.srcObject = null;
}

/** Returns true only when the active camera track explicitly exposes torch support. */
export function supportsTorch(track: MediaStreamTrack | null): boolean {
  const capabilities = getTrackCapabilities(track);
  if (!capabilities) return false;
  const torch = capabilities.torch;
  return torch === true || (Array.isArray(torch) && torch.includes(true));
}

/** Apply a torch constraint without restarting the camera stream. */
export async function applyTorch(
  track: MediaStreamTrack,
  enabled: boolean
): Promise<void> {
  const advanced = [{ torch: enabled }] as unknown as MediaTrackConstraintSet[];
  await track.applyConstraints({ advanced });
}

export interface StabilizationControl {
  key: 'videoStabilization' | 'imageStabilization' | 'stabilizationMode';
  enabledValue: boolean | string;
  disabledValue: boolean | string;
}

/**
 * Read only explicit stabilization capabilities reported by this track.
 * These names are not part of the broadly implemented camera capability set,
 * so the feature remains unavailable unless a browser reports them directly.
 */
export function getStabilizationControl(
  track: MediaStreamTrack | null
): StabilizationControl | null {
  const capabilities = getTrackCapabilities(track);
  if (!capabilities) return null;

  for (const key of ['videoStabilization', 'imageStabilization'] as const) {
    const values = capabilities[key];
    if (values === true) {
      return { key, enabledValue: true, disabledValue: false };
    }
    if (Array.isArray(values) && values.includes(true)) {
      return { key, enabledValue: true, disabledValue: false };
    }
  }

  const modes = capabilities.stabilizationMode;
  if (!Array.isArray(modes) || !modes.every((mode) => typeof mode === 'string')) return null;
  const normalizedModes = modes.map((mode) => String(mode).toLowerCase());
  const disabledIndex = normalizedModes.findIndex((mode) => ['off', 'none', 'disabled'].includes(mode));
  const enabledIndex = normalizedModes.findIndex((mode) =>
    ['standard', 'on', 'auto', 'continuous', 'enabled'].includes(mode)
  );
  if (disabledIndex < 0 || enabledIndex < 0) return null;

  return {
    key: 'stabilizationMode',
    enabledValue: String(modes[enabledIndex]),
    disabledValue: String(modes[disabledIndex]),
  };
}

/** Apply a stabilization mode previously reported by the active camera track. */
export async function applyStabilization(
  track: MediaStreamTrack,
  control: StabilizationControl,
  enabled: boolean
): Promise<void> {
  const value = enabled ? control.enabledValue : control.disabledValue;
  const advanced = [{ [control.key]: value }] as unknown as MediaTrackConstraintSet[];
  await track.applyConstraints({ advanced });
}

function getTrackCapabilities(track: MediaStreamTrack | null): Record<string, unknown> | null {
  if (!track || typeof track.getCapabilities !== 'function') return null;
  try {
    return track.getCapabilities() as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseCameraError(error: unknown): CameraError {
  if (isCameraError(error)) return error;

  if (error instanceof DOMException && error.name === 'AbortError') {
    return buildCameraError('unknown', 'Camera request was cancelled.');
  }

  if (!isSecureContext) {
    return buildCameraError(
      'insecure',
      'Camera requires a secure connection (HTTPS). Please open the app over HTTPS.'
    );
  }

  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return buildCameraError(
          'permission',
          'Camera permission was denied. Please allow camera access in your browser settings.'
        );
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return buildCameraError('unavailable', 'No camera was found on this device.');
      case 'NotReadableError':
      case 'TrackStartError':
        return buildCameraError(
          'unavailable',
          'Camera is already in use by another app. Close other apps using the camera and try again.'
        );
      case 'OverconstrainedError':
        return buildCameraError(
          'constraint',
          'The camera could not satisfy the requested video settings.'
        );
      case 'SecurityError':
        return buildCameraError(
          'insecure',
          'Camera access was blocked by a security policy. Ensure the app is served over HTTPS.'
        );
      case 'NotSupportedError':
        return buildCameraError('unsupported', 'Camera constraints are not supported in this browser.');
      default:
        return buildCameraError('unknown', error.message || 'An unknown camera error occurred.');
    }
  }

  if (typeof OverconstrainedError !== 'undefined' && error instanceof OverconstrainedError) {
    return buildCameraError('constraint', 'The camera could not satisfy the requested video settings.');
  }

  if (error instanceof TypeError) {
    return buildCameraError(
      'unsupported',
      'Invalid camera request. This may be a browser compatibility issue.'
    );
  }

  if (error instanceof Error) return buildCameraError('unknown', error.message);
  return buildCameraError('unknown', 'An unknown camera error occurred.');
}

export function isCameraError(error: unknown): error is CameraError {
  if (typeof error !== 'object' || error === null) return false;
  const candidate = error as Partial<CameraError>;
  return (
    typeof candidate.message === 'string' &&
    ['permission', 'unavailable', 'unsupported', 'insecure', 'constraint', 'unknown'].includes(
      candidate.type ?? ''
    )
  );
}

function buildCameraError(type: CameraError['type'], message: string): CameraError {
  return { type, message };
}

export function isCameraSupported(): boolean {
  return isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}

/** Draws at the requested display dimensions and returns an object URL. */
export async function bitmapToObjectUrl(
  bitmap: ImageBitmap,
  width: number,
  height: number
): Promise<string> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d');
    if (context) {
      try {
        context.drawImage(bitmap, 0, 0, width, height);
        const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.95 });
        return URL.createObjectURL(blob);
      } catch {
        // Fall back to an HTML canvas if OffscreenCanvas encoding is unavailable.
      }
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Cannot get 2D context for bitmap conversion');
  context.drawImage(bitmap, 0, 0, width, height);

  let blob = await canvasToBlob(canvas, 'image/webp', 0.95);
  if (!blob) blob = await canvasToBlob(canvas, 'image/png');
  if (!blob) throw new Error('Canvas image encoding failed');
  return URL.createObjectURL(blob);
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}
