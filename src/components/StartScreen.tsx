import React from 'react';

interface Props {
  /** True once Phaser has finished loading assets and the game can begin. */
  ready: boolean;
  onStart: () => void;
}

const StartScreen: React.FC<Props> = ({ ready, onStart }) => {
  return (
    <div className="start-overlay">
      <h1 className="start-title">METAL RAPTORS</h1>
      <button
        className="start-btn"
        onClick={onStart}
        disabled={!ready}
      >
        {ready ? '▶ Start' : 'Loading…'}
      </button>
    </div>
  );
};

export default StartScreen;
