import { useState, useCallback } from 'react';
import { GameOutcome } from '../types/game.types';
import { gameEvents, EVENTS } from '../game/Game';
import { getCompleted, markCompleted } from '../game/utils/progress';

export function useGame() {
  const [outcome, setOutcome] = useState<GameOutcome>(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const [isReady, setIsReady]     = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const [playerHealth, setPlayerHealth] = useState({ current: 100, max: 100 });

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => getCompleted());

  const attachListeners = useCallback(() => {
    gameEvents.on(EVENTS.ASSETS_LOADED, () => {
      setIsReady(true);
    });

    gameEvents.on(
      EVENTS.GAME_OVER,
      ({ outcome, levelId }: { outcome: 'VICTORY' | 'DEFEAT'; levelId?: string }) => {
        setOutcome(outcome);
        setIsGameOver(true);

        if (outcome === 'VICTORY' && levelId) {
          markCompleted(levelId);
          setCompleted(getCompleted());
        }
      },
    );

    gameEvents.on(
      EVENTS.PLAYER_HEALTH_CHANGED,
      ({ current, max }: { current: number; max: number }) => {
        setPlayerHealth({ current, max });
      },
    );
  }, []);

  const startGame = useCallback((levelId: string) => {
    setSelectedLevelId(levelId);
    setIsStarted(true);
    gameEvents.emit(EVENTS.START_GAME, { levelId });
  }, []);

  const restartGame = useCallback(() => {
    setIsGameOver(false);
    setOutcome(null);
    gameEvents.emit(EVENTS.RESTART_GAME, { levelId: selectedLevelId });
  }, [selectedLevelId]);

  const exitToMenu = useCallback(() => {
    setIsGameOver(false);
    setOutcome(null);
    setIsStarted(false);
    gameEvents.emit(EVENTS.EXIT_TO_MENU);
  }, []);

  return {
    outcome,
    isGameOver,
    isReady,
    isStarted,
    playerHealth,
    completed,
    selectedLevelId,
    attachListeners,
    startGame,
    restartGame,
    exitToMenu,
  };
}
