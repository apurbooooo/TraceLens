import { useCallback, useEffect, useRef } from 'react';
import type { UploadedImage } from '../../types';
import { bitmapToObjectUrl, canvasToBlob, MAX_DISPLAY_SIZE } from '../camera/cameraUtils';

const MAX_FILE_SIZE_MB = 50;

export interface ImageUploadResult {
  image: UploadedImage;
}

export interface ImageUploadError {
  message: string;
}

type UploadCallback = (result: ImageUploadResult | null, error?: ImageUploadError) => void;

function generateId(): string {
  return `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function getDisplayDimensions(width: number, height: number) {
  const ratio = Math.min(1, MAX_DISPLAY_SIZE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

function validateFile(file: File): void {
  const isImage = file.type.startsWith('image/') || file.type === '';
  if (!isImage) throw new Error(`Unsupported file type: ${file.type || 'unknown'}`);

  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > MAX_FILE_SIZE_MB) {
    throw new Error(
      `Image is too large (${sizeMB.toFixed(1)} MB). Maximum is ${MAX_FILE_SIZE_MB} MB.`
    );
  }
}

async function loadWithImageBitmap(file: File): Promise<UploadedImage> {
  let bitmap: ImageBitmap | null = null;
  let displayUrl: string | null = null;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width < 1 || bitmap.height < 1) throw new Error('Image has invalid dimensions.');

    const display = getDisplayDimensions(bitmap.width, bitmap.height);
    displayUrl = await bitmapToObjectUrl(bitmap, display.width, display.height);
    return {
      id: generateId(),
      displayUrl,
      displayWidth: display.width,
      displayHeight: display.height,
      naturalWidth: bitmap.width,
      naturalHeight: bitmap.height,
    };
  } catch (error) {
    if (displayUrl) URL.revokeObjectURL(displayUrl);
    throw error;
  } finally {
    // The single decoded source bitmap is closed on success and failure.
    bitmap?.close();
  }
}

async function loadWithHtmlImage(file: File): Promise<UploadedImage> {
  const sourceUrl = URL.createObjectURL(file);
  const image = new Image();
  let canvas: HTMLCanvasElement | null = null;

  try {
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to decode image. The file may be corrupt.'));
      image.src = sourceUrl;
    });

    const naturalWidth = image.naturalWidth;
    const naturalHeight = image.naturalHeight;
    if (naturalWidth < 1 || naturalHeight < 1) throw new Error('Image has invalid dimensions.');

    const display = getDisplayDimensions(naturalWidth, naturalHeight);
    canvas = document.createElement('canvas');
    canvas.width = display.width;
    canvas.height = display.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Cannot get 2D context to resize image');
    context.drawImage(image, 0, 0, display.width, display.height);

    let blob = await canvasToBlob(canvas, 'image/webp', 0.95);
    if (!blob) blob = await canvasToBlob(canvas, 'image/png');
    if (!blob) throw new Error('Canvas image encoding failed');

    return {
      id: generateId(),
      displayUrl: URL.createObjectURL(blob),
      displayWidth: display.width,
      displayHeight: display.height,
      naturalWidth,
      naturalHeight,
    };
  } finally {
    URL.revokeObjectURL(sourceUrl);
    image.onload = null;
    image.onerror = null;
    image.src = '';
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
  }
}

async function loadImageFile(file: File): Promise<UploadedImage> {
  validateFile(file);

  if (typeof createImageBitmap === 'function') {
    try {
      return await loadWithImageBitmap(file);
    } catch {
      // Older decoders and some image formats work through HTMLImageElement.
    }
  }

  return loadWithHtmlImage(file);
}

export function useImageUpload(onResult: UploadCallback) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(false);
  const onResultRef = useRef(onResult);

  useEffect(() => {
    onResultRef.current = onResult;
  }, [onResult]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      if (inputRef.current) inputRef.current.onchange = null;
    };
  }, []);

  const trigger = useCallback(() => {
    if (!inputRef.current) {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.multiple = false;
      inputRef.current = input;
    }

    const input = inputRef.current;
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      input.value = '';
      const generation = ++generationRef.current;

      void (async () => {
        let image: UploadedImage;
        try {
          image = await loadImageFile(file);
        } catch (error) {
          if (!mountedRef.current || generation !== generationRef.current) return;
          onResultRef.current(null, {
            message: error instanceof Error ? error.message : 'Failed to load image.',
          });
          return;
        }

        if (!mountedRef.current || generation !== generationRef.current) {
          URL.revokeObjectURL(image.displayUrl);
          return;
        }

        onResultRef.current({ image });
      })();
    };

    input.click();
  }, []);

  const revokeImage = useCallback((image: UploadedImage) => {
    URL.revokeObjectURL(image.displayUrl);
  }, []);

  const cancelPending = useCallback(() => {
    generationRef.current += 1;
  }, []);

  return { trigger, revokeImage, cancelPending };
}
