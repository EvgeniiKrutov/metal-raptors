import React from 'react';

interface Props {
  musicEnabled: boolean;
  onResume: () => void;
  onToggleMusic: () => void;
  onExitToMenu: () => void;
}

const PauseScreen: React.FC<Props> = ({ musicEnabled, onResume, onToggleMusic, onExitToMenu }) => {
  return (
    <div className="pause-overlay">
      <h1 className="pause-title">PAUSED</h1>

      <div className="pause-actions">
        <button className="play-again-btn" onClick={onResume}>
          ▶ Resume
        </button>
        <button className="play-again-btn" onClick={onToggleMusic}>
          ♫ Music: {musicEnabled ? 'On' : 'Off'}
        </button>
        <button className="play-again-btn" onClick={onExitToMenu}>
          ▣ Menu
        </button>
      </div>
    </div>
  );
};

export default PauseScreen;
