import React, { useEffect, useRef } from 'react';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** Max height as CSS value */
  maxHeight?: string;
}

/**
 * Mobile bottom sheet panel with backdrop dismiss and smooth slide animation.
 */
export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = '70vh',
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-200"
        style={{
          background: 'rgba(0,0,0,0.6)',
          opacity: isOpen ? 1 : 0,
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed left-0 right-0 bottom-0 z-50 rounded-t-2xl border-t transition-transform duration-300 ease-out"
        style={{
          background: '#141414',
          borderColor: 'rgba(255,255,255,0.08)',
          transform: isOpen ? 'translateY(0)' : 'translateY(100%)',
          maxHeight,
          overflowY: 'auto',
          WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
          paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 16px)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div
            className="rounded-full"
            style={{ width: '40px', height: '4px', background: 'rgba(255,255,255,0.2)' }}
          />
        </div>

        {/* Title */}
        {title && (
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}
          >
            <h2 className="text-sm font-semibold" style={{ color: '#f0f0f0' }}>
              {title}
            </h2>
            <button
              aria-label="Close panel"
              onClick={onClose}
              className="flex items-center justify-center rounded-lg text-sm font-medium"
              style={{
                minWidth: '44px',
                minHeight: '32px',
                color: 'rgba(240,240,240,0.5)',
                background: 'transparent',
                border: 'none',
              }}
            >
              Done
            </button>
          </div>
        )}

        {/* Content */}
        <div className="px-5 py-4">{children}</div>
      </div>
    </>
  );
};
