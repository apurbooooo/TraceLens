import React, { useCallback } from 'react';
import { Camera, ImagePlus, Aperture, Mail } from 'lucide-react';
import { useAppStore } from './store';
import { useImageUpload } from '../features/image/useImageUpload';
import type { UploadedImage } from '../types';
import { DEFAULT_TRANSFORM } from '../types';
import { isCameraSupported } from '../features/camera/cameraUtils';
import { releaseSketchImage } from '../features/image-processing/useSketchImage';

/** Revoke displayUrl of a previous image to free object URL memory */
function revokeUploadedImage(image: UploadedImage): void {
  URL.revokeObjectURL(image.displayUrl);
  releaseSketchImage(image.id);
}

/**
 * HomeScreen — landing / onboarding.
 *
 * Two CTAs:
 *  1. Upload image → auto-navigate to camera
 *  2. Open camera directly (useful if user wants to set up camera first)
 */
export const HomeScreen: React.FC = () => {
  const setScreen = useAppStore((s) => s.setScreen);
  const setUploadedImage = useAppStore((s) => s.setUploadedImage);
  const setTransform = useAppStore((s) => s.setTransform);
  const setLocked = useAppStore((s) => s.setLocked);
  const uploadedImage = useAppStore((s) => s.uploadedImage);

  const cameraSupported = isCameraSupported();

  const handleImageResult = useCallback(
    (result: { image: UploadedImage } | null, error?: { message: string }) => {
      if (error) {
        alert(error.message);
        return;
      }
      if (result) {
        if (uploadedImage) {
          revokeUploadedImage(uploadedImage);
        }
        setUploadedImage(result.image);
        setTransform({ ...DEFAULT_TRANSFORM });
        setLocked(false);
        setScreen('camera');
      }
    },
    [uploadedImage, setUploadedImage, setTransform, setLocked, setScreen]
  );

  const { trigger } = useImageUpload(handleImageResult);

  return (
    <div
      className="flex flex-col items-center justify-between overflow-hidden"
      style={{
        height: '100svh',
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 24px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 32px)',
        paddingLeft: '24px',
        paddingRight: '24px',
        background: 'linear-gradient(180deg, #0d0d0d 0%, #111 100%)',
      }}
    >
      {/* Brand */}
      <div className="flex flex-col items-center gap-3 pt-8">
        <div
          className="flex items-center justify-center w-20 h-20 rounded-3xl"
          style={{
            background: 'linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%)',
            boxShadow: '0 8px 32px rgba(59,130,246,0.4)',
          }}
        >
          <Aperture size={36} color="#fff" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <h1
            className="text-4xl font-bold"
            style={{ color: '#f0f0f0', letterSpacing: '-0.02em' }}
          >
            TraceLens
          </h1>
          <p className="text-sm font-medium" style={{ color: 'rgba(240,240,240,0.45)' }}>
            See it. Trace it. Draw it.
          </p>
        </div>
      </div>

      {/* Description */}
      <div className="flex flex-col gap-4 w-full max-w-sm text-center">
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,240,240,0.55)' }}>
          Upload any reference image and see it as a transparent overlay on your camera.
          Place paper underneath your phone and trace directly on it.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {['Live camera overlay', 'Pinch & rotate', 'Opacity control', 'Works offline'].map(
            (f) => (
              <span
                key={f}
                className="text-xs px-3 py-1 rounded-full"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  color: 'rgba(240,240,240,0.5)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}
              >
                {f}
              </span>
            )
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 w-full max-w-sm">
        {!cameraSupported && (
          <div
            className="text-center text-sm py-3 px-4 rounded-xl"
            style={{
              background: 'rgba(239,68,68,0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239,68,68,0.2)',
            }}
          >
            Camera requires HTTPS. Open the app over a secure connection.
          </div>
        )}

        {/* Primary */}
        <button
          onClick={trigger}
          disabled={!cameraSupported}
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-semibold
                     text-base transition-all active:scale-[0.98]"
          style={{
            background: cameraSupported
              ? 'linear-gradient(135deg, #1d4ed8, #3b82f6)'
              : 'rgba(255,255,255,0.05)',
            color: cameraSupported ? '#fff' : 'rgba(240,240,240,0.3)',
            border: 'none',
            minHeight: '56px',
            boxShadow: cameraSupported ? '0 4px 20px rgba(59,130,246,0.35)' : 'none',
          }}
        >
          <ImagePlus size={22} />
          Upload Image &amp; Start
        </button>

        {/* Secondary */}
        <button
          onClick={() => setScreen('camera')}
          disabled={!cameraSupported}
          className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl font-medium
                     text-base transition-all active:scale-[0.98]"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: cameraSupported ? 'rgba(240,240,240,0.8)' : 'rgba(240,240,240,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
            minHeight: '56px',
          }}
        >
          <Camera size={22} />
          Open Camera
        </button>

        {/* Continue with current image */}
        {uploadedImage && (
          <button
            onClick={() => setScreen('camera')}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm
                       font-medium transition-all active:scale-[0.98]"
            style={{
              background: 'rgba(34,197,94,0.1)',
              color: '#22c55e',
              border: '1px solid rgba(34,197,94,0.2)',
              minHeight: '48px',
            }}
          >
            Continue with current image →
          </button>
        )}

        <div className="flex flex-col gap-4 mt-2">
          <p className="text-center text-xs" style={{ color: 'rgba(240,240,240,0.25)' }}>
            Images stay on your device. Nothing is uploaded.
          </p>

          <div 
            className="flex flex-col items-center gap-3 pt-4 w-full" 
            style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
          >
            <p className="text-center text-xs leading-relaxed" style={{ color: 'rgba(240,240,240,0.35)' }}>
              Built by Apurbo<br/>
              Undergraduate CSE student from Bangladesh
            </p>
            
            <div className="text-center text-xs leading-relaxed" style={{ color: 'rgba(240,240,240,0.35)' }}>
              Found a bug or something not working?<br/>
              <a
                href="mailto:anxapurbo@gmail.com?subject=TraceLens%20Bug%20Report&body=Hi%20Apurbo,%0A%0AI%20found%20a%20bug%20in%20TraceLens.%0A%0ADevice:%0ABrowser:%0AWhat%20happened:%0ASteps%20to%20reproduce:%0A%0A"
                className="inline-flex items-center justify-center gap-1.5 transition-opacity active:opacity-70 mt-1"
                style={{ color: '#3b82f6', textDecoration: 'none' }}
              >
                <Mail size={14} />
                Email me at anxapurbo@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
