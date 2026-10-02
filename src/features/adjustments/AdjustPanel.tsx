import React, { useCallback } from 'react';
import { useAppStore } from '../../app/store';
import { Slider } from '../../components/Slider';
import { BottomSheet } from '../../components/BottomSheet';

/**
 * AdjustPanel — bottom sheet with image appearance sliders.
 *
 * All adjustments here are implemented via CSS filters (fast path).
 * No canvas processing, no worker needed for these controls.
 *
 * B&W and Sketch are quick tracing modes in the camera toolbar. Additional
 * threshold, outline, and edge controls remain future image-processing work.
 */
export const AdjustPanel: React.FC = () => {
  const showAdjustPanel = useAppStore((s) => s.showAdjustPanel);
  const setShowAdjustPanel = useAppStore((s) => s.setShowAdjustPanel);
  const adjustments = useAppStore((s) => s.adjustments);
  const setAdjustments = useAppStore((s) => s.setAdjustments);
  const resetAdjustments = useAppStore((s) => s.resetAdjustments);

  const handleClose = useCallback(() => setShowAdjustPanel(false), [setShowAdjustPanel]);

  return (
    <BottomSheet
      isOpen={showAdjustPanel}
      onClose={handleClose}
      title="Adjustments"
      maxHeight="80vh"
    >
      <div className="flex flex-col gap-5">
        {/* Reset all */}
        <div className="flex justify-end">
          <button
            onClick={resetAdjustments}
            className="text-xs font-medium px-3 py-1.5 rounded-lg active:scale-95 transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: 'rgba(240,240,240,0.6)',
              border: 'none',
            }}
          >
            Reset All
          </button>
        </div>

        <Slider
          label="Opacity"
          value={adjustments.opacity}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setAdjustments({ opacity: v })}
        />

        <Slider
          label="Brightness"
          value={adjustments.brightness}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => setAdjustments({ brightness: v })}
        />

        <Slider
          label="Contrast"
          value={adjustments.contrast}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => setAdjustments({ contrast: v })}
        />

        <Slider
          label="Saturation"
          value={adjustments.saturation}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => setAdjustments({ saturation: v })}
        />

        <Slider
          label="Grayscale"
          value={adjustments.grayscale}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setAdjustments({ grayscale: v })}
        />

        <Slider
          label="Invert"
          value={adjustments.invert}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => setAdjustments({ invert: v })}
        />

        <Slider
          label="Blur"
          value={adjustments.blur}
          min={0}
          max={20}
          step={0.5}
          formatValue={(v) => `${v.toFixed(1)}px`}
          onChange={(v) => setAdjustments({ blur: v })}
        />
      </div>
    </BottomSheet>
  );
};
