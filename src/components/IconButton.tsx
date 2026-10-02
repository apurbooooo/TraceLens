import React from 'react';

interface IconButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  locked?: boolean;
  disabled?: boolean;
  title?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'accent' | 'danger' | 'ghost';
  className?: string;
}

const sizeMap = {
  sm: { button: '40px', iconSize: 18 },
  md: { button: '48px', iconSize: 22 },
  lg: { button: '56px', iconSize: 26 },
};

const variantStyles = {
  default: {
    base: 'rgba(255,255,255,0.08)',
    active: '#3b82f6',
    border: 'rgba(255,255,255,0.06)',
  },
  accent: {
    base: 'rgba(59,130,246,0.2)',
    active: '#3b82f6',
    border: 'rgba(59,130,246,0.3)',
  },
  danger: {
    base: 'rgba(239,68,68,0.15)',
    active: '#ef4444',
    border: 'rgba(239,68,68,0.2)',
  },
  ghost: {
    base: 'transparent',
    active: 'rgba(255,255,255,0.12)',
    border: 'transparent',
  },
};

/**
 * Touch-friendly icon button with accessible label and multiple variants.
 * Minimum touch target: 40×40px. Comfortable: 48×48px.
 */
export const IconButton: React.FC<IconButtonProps> = ({
  icon,
  label,
  onClick,
  active = false,
  locked = false,
  disabled = false,
  title,
  size = 'md',
  variant = 'default',
  className = '',
}) => {
  const dim = sizeMap[size];
  const colors = variantStyles[variant];

  const bg = locked ? '#f59e0b' : active ? colors.active : colors.base;
  const textColor = locked ? '#000' : '#fff';

  return (
    <button
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      title={title}
      onClick={onClick}
      className={`relative flex items-center justify-center rounded-xl border transition-all duration-150 select-none ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'active:scale-95 cursor-pointer'
      } ${className}`}
      style={{
        minWidth: dim.button,
        minHeight: dim.button,
        background: bg,
        borderColor: locked ? 'rgba(245,158,11,0.3)' : colors.border,
        color: textColor,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {/* Render icon — pass iconSize as a data attribute that Lucide reads */}
      <span
        className="flex items-center justify-center"
        style={{ width: dim.iconSize, height: dim.iconSize }}
        aria-hidden="true"
      >
        {icon}
      </span>

      {locked && (
        <span
          className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full"
          style={{ background: '#f59e0b' }}
          aria-hidden="true"
        />
      )}
    </button>
  );
};
