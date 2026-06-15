import React from 'react';

interface Props {
  onResume: () => void;
  onExitToMenu: () => void;
}

const PauseScreen: React.FC<Props> = ({ onResume, onExitToMenu }) => {
  return (
    <div className="pause-overlay">
      <h1 className="pause-title">PAUSED</h1>

      <div className="pause-actions">
        <button className="play-again-btn" onClick={onResume}>
          ▶ Resume
        </button>
        <button className="play-again-btn" onClick={onExitToMenu}>
          ▣ Menu
        </button>
      </div>
    </div>
  );
};

export default PauseScreen;
