import React from 'react';
import { GameOutcome } from '../types/game.types';

interface Props {
  outcome: Exclude<GameOutcome, null>;
  onRestart: () => void;
  onExitToMenu: () => void;
}

const GameOverScreen: React.FC<Props> = ({ outcome, onRestart, onExitToMenu }) => {
  const isVictory = outcome === 'VICTORY';

  return (
    <div className="game-over-overlay">
      <h1 className={`game-over-title ${isVictory ? 'victory' : 'defeat'}`}>
        {isVictory ? '✈ VICTORY!' : '✗ GAME OVER'}
      </h1>
      <p
        style={{
          color: 'rgba(255,255,255,0.6)',
          fontSize: '1rem',
          letterSpacing: '0.15em',
          marginBottom: '2.5rem',
          fontFamily: 'Courier New, Courier, monospace',
          textTransform: 'uppercase',
        }}
      >
        {isVictory ? 'Level cleared!' : 'Your plane went down.'}
      </p>

      <div className="game-over-actions">
        {isVictory ? (
          <>
            <button className="play-again-btn" onClick={onExitToMenu}>
              ▣ Continue
            </button>
            <button className="play-again-btn" onClick={onRestart}>
              ↻ Restart
            </button>
          </>
        ) : (
          <>
            <button className="play-again-btn" onClick={onRestart}>
              ↻ Restart
            </button>
            <button className="play-again-btn" onClick={onExitToMenu}>
              ▣ Menu
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default GameOverScreen;
