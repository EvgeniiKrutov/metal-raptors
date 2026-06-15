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
    completed,
    attachListeners,
    startGame,
    restartGame,
    exitToMenu,
  } = useGame();

  const handleGameReady = useCallback(() => {
    attachListeners();
  }, [attachListeners]);

  return (
    <div className="game-wrapper">
      <GameContainer onReady={handleGameReady} />

      {/* Minimal React HUD (version stamp etc.) */}
      <HUD />

      {/* Level selector — shown until the player picks a level */}
      {!isStarted && (
        <StartScreen ready={isReady} completed={completed} onStart={startGame} />
      )}

      {/* Game-over overlay — shown by React so it's always on top */}
      {isGameOver && outcome && (
        <GameOverScreen
          outcome={outcome}
          onRestart={restartGame}
          onExitToMenu={exitToMenu}
        />
      )}
    </div>
  );
};

export default App;
