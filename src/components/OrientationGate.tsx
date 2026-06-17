import React, { useEffect, useState } from 'react';
import { isTouchDevice } from '../game/utils/helpers';

const OrientationGate: React.FC = () => {
  const [showRotate, setShowRotate] = useState(false);

  useEffect(() => {
    if (!isTouchDevice()) return;

    try {
      const orientation = screen.orientation as unknown as
        | { lock?: (orientation: string) => Promise<void> }
        | undefined;
      orientation?.lock?.('landscape').catch(() => undefined);
    } catch (err) {
      void err;
    }

    const evaluate = () => setShowRotate(window.innerHeight > window.innerWidth);
    evaluate();

    window.addEventListener('resize', evaluate);
    window.addEventListener('orientationchange', evaluate);
    return () => {
      window.removeEventListener('resize', evaluate);
      window.removeEventListener('orientationchange', evaluate);
    };
  }, []);

  if (!showRotate) return null;

  return (
    <div className="rotate-overlay">
      <div className="rotate-icon">📱</div>
      <div className="rotate-text">Rotate your device to landscape</div>
    </div>
  );
};

export default OrientationGate;
