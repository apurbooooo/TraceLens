import React, { useCallback } from 'react';
import { ArrowLeft, ImagePlus, Trash2, Maximize, Minimize } from 'lucide-react';
import { useAppStore } from '../../app/store';
import { IconButton } from '../../components/IconButton';
import { useImageUpload } from '../image/useImageUpload';
import type { UploadedImage } from '../../types';
import { DEFAULT_TRANSFORM } from '../../types';
import { releaseSketchImage } from '../image-processing/useSketchImage';

interface CameraHeaderProps {
  isFullscreen: boolean;
  fullscreenSupported: boolean;
  onToggleFullscreen: () => void;
}

/** Revoke displayUrl of a previous image to free object URL memory */
function revokeUploadedImage(image: UploadedImage): void {
  URL.revokeObjectURL(image.displayUrl);
  releaseSketchImage(image.id);
}

/**
 * CameraHeader — minimal top bar.
 * Back | Title + wake indicator | Upload | Remove | Fullscreen
 */
export const CameraHeader: React.FC<CameraHeaderProps> = ({
  isFullscreen,
  fullscreenSupported,
  onToggleFullscreen,
}) => {
  const setScreen = useAppStore((s) => s.setScreen);
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const setUploadedImage = useAppStore((s) => s.setUploadedImage);
  const setTransform = useAppStore((s) => s.setTransform);
  const isLocked = useAppStore((s) => s.isLocked);
  const setLocked = useAppStore((s) => s.setLocked);
  const wakeLockActive = useAppStore((s) => s.wakeLockActive);

  const handleImageResult = useCallback(
    (result: { image: UploadedImage } | null, error?: { message: string }) => {
      if (error) {
        // TODO Phase 4: replace with in-app toast notification
        alert(error.message);
        return;
      }
      if (result) {
        // Revoke previous image's object URL before replacing
        if (uploadedImage) {
          revokeUploadedImage(uploadedImage);
        }
        setUploadedImage(result.image);
        // Reset transform so auto-fit fires in CameraScreen
        setTransform({ ...DEFAULT_TRANSFORM });
        setLocked(false);
      }
    },
    [uploadedImage, setUploadedImage, setTransform, setLocked]
  );

  const { trigger, cancelPending } = useImageUpload(handleImageResult);

  const handleRemoveImage = useCallback(() => {
    if (!uploadedImage) return;
    cancelPending();
    revokeUploadedImage(uploadedImage);
    setUploadedImage(null);
    setLocked(false);
    setTransform({ ...DEFAULT_TRANSFORM });
  }, [uploadedImage, setUploadedImage, setLocked, setTransform, cancelPending]);

  return (
    <div
      className="flex items-center gap-1 px-2 py-2"
      style={{
        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 8px)',
        background: 'rgba(10,10,10,0.75)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        zIndex: 10,
        position: 'relative',
      }}
    >
      {/* Back */}
      <IconButton
        icon={<ArrowLeft size={22} />}
        label="Back to home"
        onClick={() => setScreen('home')}
        size="md"
        variant="ghost"
      />

      {/* Title */}
      <div className="flex-1 flex items-center justify-center gap-2">
        <span className="text-sm font-bold tracking-wide" style={{ color: '#f0f0f0' }}>
          TraceLens
        </span>
        {wakeLockActive && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: 'rgba(34,197,94,0.2)',
              color: '#22c55e',
              fontSize: '10px',
              letterSpacing: '0.05em',
            }}
          >
            AWAKE
          </span>
        )}
      </div>

      {/* Upload image */}
      <IconButton
        icon={<ImagePlus size={22} />}
        label="Upload reference image"
        onClick={trigger}
        size="md"
        variant="ghost"
      />

      {/* Remove image */}
      {uploadedImage && (
        <IconButton
          icon={<Trash2 size={22} />}
          label="Remove image"
          onClick={handleRemoveImage}
          disabled={isLocked}
          size="md"
          variant="ghost"
        />
      )}

      {/* Fullscreen toggle */}
      <IconButton
        icon={isFullscreen ? <Minimize size={22} /> : <Maximize size={22} />}
        label={
          fullscreenSupported
            ? isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'
            : 'Fullscreen is not supported in this browser'
        }
        title={
          fullscreenSupported
            ? undefined
            : 'Fullscreen is not supported in this browser.'
        }
        disabled={!fullscreenSupported}
        onClick={onToggleFullscreen}
        size="md"
        variant="ghost"
      />
    </div>
  );
};
