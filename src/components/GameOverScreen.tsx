import React from 'react';
import { GameOutcome } from '../types/game.types';

interface Props {
  outcome: Exclude<GameOutcome, null>;
  onPlayAgain: () => void;
}

const GameOverScreen: React.FC<Props> = ({ outcome, onPlayAgain }) => {
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
        {isVictory ? 'Enemy destroyed!' : 'Your plane went down.'}
      </p>
      <button className="play-again-btn" onClick={onPlayAgain}>
        ▶ Play Again
      </button>
    </div>
  );
};

export default GameOverScreen;
