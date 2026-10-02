import React from 'react';
import { Camera, WifiOff, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { CameraError } from '../../types';
import { useAppStore } from '../../app/store';

interface CameraErrorViewProps {
  error: CameraError;
  onRetry: () => void;
}

const errorConfig: Record<
  CameraError['type'],
  { icon: React.ReactNode; title: string; instruction: string }
> = {
  permission: {
    icon: <Camera size={36} style={{ color: '#f59e0b' }} />,
    title: 'Camera Access Denied',
    instruction:
      'TraceLens needs camera access to work. Tap the camera/lock icon in your browser address bar, then allow camera access. On iPhone, go to Settings → Safari → Camera.',
  },
  unavailable: {
    icon: <WifiOff size={36} style={{ color: '#ef4444' }} />,
    title: 'Camera Unavailable',
    instruction:
      'The camera could not be started. It may be in use by another app, or no camera is available on this device. Try closing other apps and try again.',
  },
  constraint: {
    icon: <AlertTriangle size={36} style={{ color: '#f59e0b' }} />,
    title: 'Camera Settings Unsupported',
    instruction:
      'This camera cannot provide the requested video settings. Try again or use another camera if available.',
  },
  insecure: {
    icon: <ShieldAlert size={36} style={{ color: '#f59e0b' }} />,
    title: 'Secure Connection Required',
    instruction:
      'Camera access requires HTTPS. Open this page over a secure connection (https://…). If you\'re on a local network, use the HTTPS dev server: npm run dev:host',
  },
  unsupported: {
    icon: <AlertTriangle size={36} style={{ color: '#ef4444' }} />,
    title: 'Browser Not Supported',
    instruction:
      'Your browser does not support camera access. Please use Safari on iPhone/iPad, or Chrome on Android. Make sure your browser is up to date.',
  },
  unknown: {
    icon: <AlertTriangle size={36} style={{ color: '#ef4444' }} />,
    title: 'Camera Error',
    instruction:
      'An unexpected error occurred while starting the camera. Please try again.',
  },
};

export const CameraErrorView: React.FC<CameraErrorViewProps> = ({ error, onRetry }) => {
  const config = errorConfig[error.type];
  const setScreen = useAppStore((s) => s.setScreen);

  return (
    <div
      className="flex flex-col items-center justify-center gap-6 p-8 text-center"
      style={{ minHeight: '60vh' }}
    >
      <div
        className="flex items-center justify-center w-20 h-20 rounded-full"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        {config.icon}
      </div>

      <div className="flex flex-col gap-2 max-w-xs">
        <h2 className="text-xl font-semibold" style={{ color: '#f0f0f0' }}>
          {config.title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(240,240,240,0.6)' }}>
          {config.instruction}
        </p>
        {error.message && (
          <p className="text-xs italic mt-1" style={{ color: 'rgba(240,240,240,0.3)' }}>
            {error.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button
          onClick={onRetry}
          className="w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95"
          style={{
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            minHeight: '48px',
          }}
        >
          Try Again
        </button>
        <button
          onClick={() => setScreen('home')}
          className="w-full py-3 rounded-xl font-medium text-sm transition-all active:scale-95"
          style={{
            background: 'rgba(255,255,255,0.06)',
            color: 'rgba(240,240,240,0.7)',
            border: 'none',
            minHeight: '48px',
          }}
        >
          Go Back
        </button>
      </div>
    </div>
  );
};
