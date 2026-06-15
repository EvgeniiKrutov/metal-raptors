import React, { useCallback } from 'react';
import GameContainer from './GameContainer';
import GameOverScreen from './GameOverScreen';
import StartScreen from './StartScreen';
import HUD from './HUD';
import { useGame } from '../hooks/useGame';

const App: React.FC = () => {
  const {
    outcome,
    isGameOver,
    isReady,
    isStarted,
    attachListeners,
    startGame,
    restartGame,
  } = useGame();

  const handleGameReady = useCallback(() => {
    attachListeners();
  }, [attachListeners]);

  return (
    <div className="game-wrapper">
      <GameContainer onReady={handleGameReady} />

      {/* Minimal React HUD (version stamp etc.) */}
      <HUD />

      {/* Start screen — shown until the player presses Start */}
      {!isStarted && (
        <StartScreen ready={isReady} onStart={startGame} />
      )}

      {/* Game-over overlay — shown by React so it's always on top */}
      {isGameOver && outcome && (
        <GameOverScreen outcome={outcome} onPlayAgain={restartGame} />
      )}
    </div>
  );
};

export default App;
