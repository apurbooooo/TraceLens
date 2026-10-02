import React, { useCallback } from 'react';
import {
  Contrast,
  Flashlight,
  Focus,
  FlipHorizontal,
  FlipVertical,
  Lock,
  LockOpen,
  RotateCcw,
  SlidersHorizontal,
  Maximize,
  RefreshCw,
  WandSparkles,
} from 'lucide-react';
import { useAppStore } from '../../app/store';
import { IconButton } from '../../components/IconButton';
import { Slider } from '../../components/Slider';
import { computeFitTransform } from '../../lib/imageUtils';

interface QuickControlsProps {
  torchSupported: boolean;
  torchEnabled: boolean;
  torchBusy: boolean;
  onToggleTorch: () => void;
  stabilizerSupported: boolean;
  stabilizerEnabled: boolean;
  stabilizerBusy: boolean;
  onToggleStabilizer: () => void;
}

interface OverlayToolbarProps {
  containerWidth: number;
  containerHeight: number;
}

export const QuickControls: React.FC<QuickControlsProps> = ({
  torchSupported,
  torchEnabled,
  torchBusy,
  onToggleTorch,
  stabilizerSupported,
  stabilizerEnabled,
  stabilizerBusy,
  onToggleStabilizer,
}) => {
  const referenceMode = useAppStore((s) => s.referenceMode);
  const setReferenceMode = useAppStore((s) => s.setReferenceMode);
  const uploadedImage = useAppStore((s) => s.uploadedImage);
  const cameraFacing = useAppStore((s) => s.cameraFacing);

  const hasImage = !!uploadedImage;
  const flashlightAvailable = cameraFacing === 'environment' && torchSupported;
  const flashlightUnavailableTitle = cameraFacing === 'user'
    ? 'Flashlight is available only on the rear camera when its torch is supported.'
    : 'Flashlight not supported on this device/browser.';
  const stabilizerTitle = !stabilizerSupported
    ? 'Steady unavailable: camera stabilization and usable device motion are unavailable or permission was denied.'
    : stabilizerEnabled
      ? 'Best-effort camera stabilization is on. Tap to turn it off.'
      : 'Best-effort camera stabilization. Uses an exposed camera control or device motion when available.';

  const handleToggleBlackAndWhite = useCallback(() => {
    setReferenceMode(referenceMode === 'bw' ? 'normal' : 'bw');
  }, [referenceMode, setReferenceMode]);

  const handleToggleSketch = useCallback(() => {
    setReferenceMode(referenceMode === 'sketch' ? 'normal' : 'sketch');
  }, [referenceMode, setReferenceMode]);

  return (
    <div className="quick-controls" role="group" aria-label="Quick tracing controls">
      <ToolbarFeatureButton
        icon={<Contrast size={16} />}
        label="B&W"
        accessibleLabel="Black & White"
        active={referenceMode === 'bw'}
        disabled={!hasImage}
        title={hasImage ? 'Black & White reference image' : 'Upload a reference image first.'}
        onClick={handleToggleBlackAndWhite}
      />
      <ToolbarFeatureButton
        icon={<WandSparkles size={16} />}
        label="Sketch"
        active={referenceMode === 'sketch'}
        disabled={!hasImage}
        title={hasImage ? 'Local pencil sketch of the reference image' : 'Upload a reference image first.'}
        onClick={handleToggleSketch}
      />
      <ToolbarFeatureButton
        icon={<Flashlight size={16} />}
        label="Flash"
        accessibleLabel={
          flashlightAvailable
            ? torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'
            : 'Flashlight not supported on this device/browser'
        }
        active={torchEnabled}
        disabled={!flashlightAvailable || torchBusy}
        busy={torchBusy}
        title={flashlightAvailable ? undefined : flashlightUnavailableTitle}
        onClick={onToggleTorch}
      />
      <ToolbarFeatureButton
        icon={<Focus size={16} />}
        label="Steady"
        accessibleLabel={
          !stabilizerSupported
            ? 'Steady unavailable'
            : stabilizerEnabled ? 'Steady on, turn off' : 'Steady off, turn on'
        }
        active={stabilizerEnabled}
        disabled={!stabilizerSupported || stabilizerBusy}
        busy={stabilizerBusy}
        title={stabilizerTitle}
        onClick={onToggleStabilizer}
      />
    </div>
  );
};

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
      className="flex flex-col gap-2 px-4 py-2"
      style={{
        background: 'rgba(10,10,10,0.88)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        paddingLeft: 'calc(env(safe-area-inset-left, 0px) + 12px)',
        paddingRight: 'calc(env(safe-area-inset-right, 0px) + 12px)',
        paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
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

interface ToolbarFeatureButtonProps {
  icon: React.ReactNode;
  label: string;
  accessibleLabel?: string;
  active: boolean;
  disabled?: boolean;
  busy?: boolean;
  title?: string;
  onClick: () => void;
}

const ToolbarFeatureButton: React.FC<ToolbarFeatureButtonProps> = ({
  icon,
  label,
  accessibleLabel = label,
  active,
  disabled = false,
  busy = false,
  title,
  onClick,
}) => (
  <button
    type="button"
    aria-label={accessibleLabel}
    aria-pressed={active}
    aria-busy={busy || undefined}
    title={title}
    disabled={disabled}
    onClick={onClick}
    className="quick-control"
    style={{
      background: active ? 'rgba(59,130,246,0.24)' : 'rgba(255,255,255,0.035)',
      borderColor: active ? 'rgba(59,130,246,0.45)' : 'rgba(255,255,255,0.06)',
      color: active ? '#bfdbfe' : 'rgba(240,240,240,0.72)',
      opacity: disabled ? 0.42 : 1,
      cursor: disabled ? 'not-allowed' : 'pointer',
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    <span className="flex items-center justify-center" aria-hidden="true">{icon}</span>
    <span>{label}</span>
  </button>
);
