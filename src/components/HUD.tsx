import React from 'react';

/**
 * React HUD overlay — currently minimal because the in-game health bars
 * are rendered by UIScene (Phaser). Extend this for React-side HUD elements
 * such as score counters, timers, or ammo indicators.
 */
const HUD: React.FC = () => {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 10,
        right: 20,
        pointerEvents: 'none',
        color: 'rgba(255,255,255,0.35)',
        fontFamily: 'Courier New, Courier, monospace',
        fontSize: '11px',
        letterSpacing: '0.08em',
        userSelect: 'none',
      }}
    >
      METAL RAPTORS v1.0
    </div>
  );
};

export default HUD;
