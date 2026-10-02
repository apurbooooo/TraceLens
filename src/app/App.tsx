import React from 'react';
import { useAppStore } from './store';
import { HomeScreen } from './HomeScreen';
import { CameraScreen } from '../features/camera/CameraScreen';

/**
 * App — root component that handles screen routing.
 *
 * TraceLens uses a simple enum-based navigation (no router library needed
 * for this single-page app). This keeps bundle size minimal and avoids
 * unnecessary complexity.
 *
 * Future: can add Capacitor navigation here for native Android.
 */
export const App: React.FC = () => {
  const screen = useAppStore((s) => s.screen);

  return (
    <>
      {screen === 'home' && <HomeScreen />}
      {screen === 'camera' && <CameraScreen />}
    </>
  );
};
