import React, { useCallback } from 'react';
import {
  FlipHorizontal,
  FlipVertical,
  Lock,
  LockOpen,
  RotateCcw,
  SlidersHorizontal,
  Maximize,
  RefreshCw,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { IconButton } from '../../components/IconButton';
import { Slider } from '../../components/Slider';
import { computeFitTransform } from '../../lib/imageUtils';

interface OverlayToolbarProps {
  containerWidth: number;
  containerHeight: number;
}

/**
 * OverlayToolbar — primary control row at the bottom of the camera view.
 *
 * Layout:
 * [Opacity slider — full width]
 * [FlipH] [FlipV] [Fit] [Reset] [Lock] [CamSwitch] [Adjust]
 *
 * Fix #2: Fit uses uploadedImage.displayWidth/displayHeight — the actual
 * rendered dimensions — not the original/natural dimensions.
 */
export const OverlayToolbar: React.FC<OverlayToolbarProps> = ({
  containerWidth,
  containerHeight,
}) => {
  const adjustments = useAppStore((s) => s.adjustments);
  const setAdjustments = useAppStore((s) => s.setAdjustments);
  const transform = useAppStore((s) => s.transform);
  const setTransform = useAppStore((s) => s.setTransform);
  const resetTransform = useAppStore((s) => s.resetTransform);
  const isLocked = useAppStore((s) => s.isLocked);
  const toggleLocked = useAppStore((s) => s.toggleLocked);
  const setShowAdjustPanel = useAppStore((s) => s.setShowAdjustPanel);
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const cameraFacing = useAppStore((s) => s.cameraFacing);
  const setCameraFacing = useAppStore((s) => s.setCameraFacing);

  const hasImage = !!uploadedImage;

  const handleFlipH = useCallback(() => {
    if (isLocked) return;
    setTransform((t) => ({ ...t, flipH: !t.flipH }));
  }, [isLocked, setTransform]);

  const handleFlipV = useCallback(() => {
    if (isLocked) return;
    setTransform((t) => ({ ...t, flipV: !t.flipV }));
  }, [isLocked, setTransform]);

  const handleFit = useCallback(() => {
    if (!uploadedImage || isLocked) return;
    if (containerWidth === 0 || containerHeight === 0) return;

    // Use displayWidth/displayHeight — the dimensions of what <img> actually renders.
    // This ensures the calculated scale matches the visual result.
    const fit = computeFitTransform(
      uploadedImage.displayWidth,
      uploadedImage.displayHeight,
      containerWidth,
      containerHeight
    );
    setTransform((t) => ({
      ...t,
      ...fit,
      rotation: 0,
      flipH: false,
      flipV: false,
    }));
  }, [uploadedImage, isLocked, containerWidth, containerHeight, setTransform]);

  const handleReset = useCallback(() => {
    if (isLocked) return;
    resetTransform();
  }, [isLocked, resetTransform]);

  const handleCameraSwitch = useCallback(() => {
    setCameraFacing(cameraFacing === 'environment' ? 'user' : 'environment');
  }, [cameraFacing, setCameraFacing]);

  return (
    <div
      className="flex flex-col gap-3 px-4 py-3"
      style={{
        background: 'rgba(10,10,10,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)',
      }}
    >
      {/* Opacity slider */}
      <Slider
        label="Opacity"
        value={adjustments.opacity}
        min={0}
        max={100}
        unit="%"
        onChange={(v) => setAdjustments({ opacity: v })}
      />

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-1">
        <IconButton
          icon={<FlipHorizontal size={20} />}
          label="Flip horizontal"
          onClick={handleFlipH}
          active={transform.flipH}
          disabled={!hasImage || isLocked}
          size="sm"
          variant="ghost"
        />

        <IconButton
          icon={<FlipVertical size={20} />}
          label="Flip vertical"
          onClick={handleFlipV}
          active={transform.flipV}
          disabled={!hasImage || isLocked}
          size="sm"
          variant="ghost"
        />

        <IconButton
          icon={<Maximize size={20} />}
          label="Fit to screen"
          onClick={handleFit}
          disabled={!hasImage || isLocked}
          size="sm"
          variant="ghost"
        />

        <IconButton
          icon={<RotateCcw size={20} />}
          label="Reset transform"
          onClick={handleReset}
          disabled={!hasImage || isLocked}
          size="sm"
          variant="ghost"
        />

        <IconButton
          icon={isLocked ? <Lock size={20} /> : <LockOpen size={20} />}
          label={isLocked ? 'Unlock image position' : 'Lock image position'}
          onClick={toggleLocked}
          locked={isLocked}
          disabled={!hasImage}
          size="sm"
          variant="ghost"
        />

        <IconButton
          icon={<RefreshCw size={20} />}
          label="Switch camera"
          onClick={handleCameraSwitch}
          size="sm"
          variant="ghost"
        />

        <IconButton
          icon={<SlidersHorizontal size={20} />}
          label="Image adjustments"
          onClick={() => setShowAdjustPanel(true)}
          disabled={!hasImage}
          size="sm"
          variant="ghost"
        />
      </div>
    </div>
  );
};
