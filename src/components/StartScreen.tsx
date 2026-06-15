import React from 'react';
import { getLevels } from '../game/config/data/levels/index';

interface Props {
  ready: boolean;
  completed: string[];
  onStart: (levelId: string) => void;
}

const StartScreen: React.FC<Props> = ({ ready, completed, onStart }) => {
  const levels = getLevels();

  return (
    <div className="start-overlay">
      <h1 className="start-title">METAL RAPTORS</h1>

      <div className="level-list">
        {levels.map((level, index) => {
          const isDone = completed.includes(level.id);
          return (
            <button
              key={level.id}
              className="level-btn"
              onClick={() => onStart(level.id)}
              disabled={!ready}
            >
              <span className="level-index">{index + 1}</span>
              <span className="level-name">{level.name}</span>
              {isDone && <span className="level-badge">✓</span>}
            </button>
          );
        })}
      </div>

      <p className="start-status">{ready ? 'Select a level' : 'Loading…'}</p>
    </div>
  );
};

export default StartScreen;
