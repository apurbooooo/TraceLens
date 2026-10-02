import React from 'react';

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
}

/**
 * Accessible, touch-friendly slider for image controls.
 */
export const Slider: React.FC<SliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
  formatValue,
}) => {
  const displayValue = formatValue ? formatValue(value) : `${Math.round(value)}${unit}`;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-medium" style={{ color: 'rgba(240,240,240,0.6)' }}>
          {label}
        </span>
        <span className="text-xs font-semibold tabular-nums" style={{ color: '#f0f0f0' }}>
          {displayValue}
        </span>
      </div>
      <div className="relative flex items-center" style={{ height: '32px' }}>
        {/* Track background */}
        <div
          className="absolute left-0 right-0 rounded-full"
          style={{
            height: '4px',
            background: 'rgba(255,255,255,0.12)',
          }}
        />
        {/* Track fill */}
        <div
          className="absolute left-0 rounded-full pointer-events-none"
          style={{
            height: '4px',
            width: `${((value - min) / (max - min)) * 100}%`,
            background: '#3b82f6',
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer"
          style={{ height: '32px', touchAction: 'none' }}
        />
        {/* Thumb visual */}
        <div
          className="absolute w-5 h-5 rounded-full pointer-events-none shadow-md"
          style={{
            left: `calc(${((value - min) / (max - min)) * 100}% - 10px)`,
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}
        />
      </div>
    </div>
  );
};
