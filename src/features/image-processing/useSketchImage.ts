import { useEffect, useState } from 'react';
import type { UploadedImage } from '../../types';

type SketchStatus = 'idle' | 'processing' | 'ready' | 'error';
type SketchResult = { imageId: string; url: string };

// Keep only the active reference's processed bitmap. Switching between normal,
// B&W, and Sketch reuses this promise/result instead of processing again.
const sketchCache = new Map<string, Promise<string>>();

export function releaseSketchImage(imageId: string): void {
  const cached = sketchCache.get(imageId);
  if (!cached) return;
  sketchCache.delete(imageId);
  void cached.then((url) => URL.revokeObjectURL(url)).catch(() => {});
}

function getCachedSketch(image: Pick<UploadedImage, 'id' | 'displayUrl'>): Promise<string> {
  const cached = sketchCache.get(image.id);
  if (cached) return cached;

  for (const cachedId of sketchCache.keys()) releaseSketchImage(cachedId);

  const processing = createSketchImage(image.displayUrl);
  sketchCache.set(image.id, processing);
  void processing.catch(() => {
    if (sketchCache.get(image.id) === processing) sketchCache.delete(image.id);
  });
  return processing;
}

/**
 * Generate a pencil-like reference from the uploaded image only.
 * Work is split across tasks so pixel math does not monopolize the camera UI.
 */
async function createSketchImage(sourceUrl: string): Promise<string> {
  const image = await loadImage(sourceUrl);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  if (!width || !height) throw new Error('The reference image has no drawable pixels.');

  const sourceCanvas = document.createElement('canvas');
  sourceCanvas.width = width;
  sourceCanvas.height = height;
  const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true });
  if (!sourceContext) throw new Error('Canvas image processing is unavailable.');

  const supportsCanvasFilters = 'filter' in sourceContext;
  if (supportsCanvasFilters) sourceContext.filter = 'grayscale(100%)';
  sourceContext.drawImage(image, 0, 0, width, height);
  sourceContext.filter = 'none';
  const sourcePixels = sourceContext.getImageData(0, 0, width, height);

  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = width;
  outputCanvas.height = height;
  const outputContext = outputCanvas.getContext('2d');
  if (!outputContext) throw new Error('Canvas image processing is unavailable.');

  if (supportsCanvasFilters) {
    const blurCanvas = document.createElement('canvas');
    blurCanvas.width = width;
    blurCanvas.height = height;
    const blurContext = blurCanvas.getContext('2d', { willReadFrequently: true });
    if (!blurContext) throw new Error('Canvas image processing is unavailable.');

    // Classic color-dodge sketch: invert and soften a grayscale copy, then
    // blend it with the original grayscale. The original file remains intact.
    blurContext.fillStyle = '#fff';
    blurContext.fillRect(0, 0, width, height);
    blurContext.filter = 'grayscale(100%) invert(100%) blur(10px)';
    blurContext.drawImage(image, 0, 0, width, height);
    blurContext.filter = 'none';
    const blurredPixels = blurContext.getImageData(0, 0, width, height);
    const rowsPerTask = 32;

    for (let startY = 0; startY < height; startY += rowsPerTask) {
      const endY = Math.min(height, startY + rowsPerTask);
      for (let y = startY; y < endY; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const base = sourcePixels.data[index];
          const invertedBlur = blurredPixels.data[index];
          const denominator = Math.max(1, 255 - invertedBlur);
          const dodged = Math.min(255, (base * 255) / denominator);
          const value = Math.max(0, Math.min(255, (dodged - 128) * 1.2 + 128));
          sourcePixels.data[index] = value;
          sourcePixels.data[index + 1] = value;
          sourcePixels.data[index + 2] = value;
        }
      }
      if (endY < height) await yieldToBrowser();
    }

    outputContext.putImageData(sourcePixels, 0, 0);
    blurCanvas.width = 0;
    blurCanvas.height = 0;
  } else {
    // Older canvas implementations without filter support get a modest Sobel
    // line-art fallback. Its work is also chunked and uses the same dimensions.
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i += 1) {
      const p = i * 4;
      const value =
        0.299 * sourcePixels.data[p] +
        0.587 * sourcePixels.data[p + 1] +
        0.114 * sourcePixels.data[p + 2];
      gray[i] = value;
    }

    const pixels = sourcePixels.data;
    for (let y = 0; y < height; y += 1) {
      const previousY = Math.max(0, y - 1);
      const nextY = Math.min(height - 1, y + 1);
      for (let x = 0; x < width; x += 1) {
        const previousX = Math.max(0, x - 1);
        const nextX = Math.min(width - 1, x + 1);
        const topLeft = gray[previousY * width + previousX];
        const top = gray[previousY * width + x];
        const topRight = gray[previousY * width + nextX];
        const left = gray[y * width + previousX];
        const right = gray[y * width + nextX];
        const bottomLeft = gray[nextY * width + previousX];
        const bottom = gray[nextY * width + x];
        const bottomRight = gray[nextY * width + nextX];
        const horizontal = -topLeft + topRight - 2 * left + 2 * right - bottomLeft + bottomRight;
        const vertical = -topLeft - 2 * top - topRight + bottomLeft + 2 * bottom + bottomRight;
        const magnitude = Math.sqrt(horizontal * horizontal + vertical * vertical);
        const value = magnitude > 90 ? 24 : 255 - magnitude * 0.45;
        const index = (y * width + x) * 4;
        pixels[index] = value;
        pixels[index + 1] = value;
        pixels[index + 2] = value;
      }
      if (y > 0 && y % 24 === 0) await yieldToBrowser();
    }
    outputContext.putImageData(sourcePixels, 0, 0);
  }

  sourceCanvas.width = 0;
  sourceCanvas.height = 0;
  const blob = await canvasToBlob(outputCanvas);
  outputCanvas.width = 0;
  outputCanvas.height = 0;
  return URL.createObjectURL(blob);
}

function loadImage(sourceUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('The reference image could not be decoded for Sketch mode.'));
    image.src = sourceUrl;
    if (image.complete && image.naturalWidth > 0) resolve(image);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('The Sketch image could not be saved locally.'));
    }, 'image/png');
  });
}

function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

export function useSketchImage(image: UploadedImage | null, active: boolean) {
  const [result, setResult] = useState<SketchResult | null>(null);
  const [status, setStatus] = useState<{ imageId: string; value: SketchStatus } | null>(null);
  const imageId = image?.id;
  const displayUrl = image?.displayUrl;

  useEffect(() => {
    if (!imageId || !displayUrl || !active) return;
    let current = true;
    void getCachedSketch({ id: imageId, displayUrl }).then(
      (url) => {
        if (!current) return;
        setResult({ imageId, url });
        setStatus({ imageId, value: 'ready' });
      },
      () => {
        if (current) setStatus({ imageId, value: 'error' });
      }
    );
    return () => {
      current = false;
    };
  }, [active, imageId, displayUrl]);

  const sketchUrl = result && imageId && result.imageId === imageId ? result.url : null;
  const sketchStatus =
    status && imageId && status.imageId === imageId
      ? status.value
      : active && imageId
        ? 'processing'
        : 'idle';

  return { sketchUrl, sketchStatus };
}
