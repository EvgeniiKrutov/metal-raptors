import { useState, useCallback } from 'react';
import { GameOutcome } from '../types/game.types';
import { gameEvents, EVENTS } from '../game/Game';

export function useGame() {
  const [outcome, setOutcome] = useState<GameOutcome>(null);
  const [isGameOver, setIsGameOver] = useState(false);

  const [playerHealth, setPlayerHealth] = useState({ current: 100, max: 100 });
  const [enemyHealth,  setEnemyHealth]  = useState({ current: 100, max: 100 });

  const attachListeners = useCallback(() => {
    gameEvents.on(EVENTS.GAME_OVER, ({ outcome }: { outcome: 'VICTORY' | 'DEFEAT' }) => {
      setOutcome(outcome);
      setIsGameOver(true);
    });

    gameEvents.on(
      EVENTS.PLAYER_HEALTH_CHANGED,
      ({ current, max }: { current: number; max: number }) => {
        setPlayerHealth({ current, max });
      },
    );

    gameEvents.on(
      EVENTS.ENEMY_HEALTH_CHANGED,
      ({ current, max }: { current: number; max: number }) => {
        setEnemyHealth({ current, max });
      },
    );
  }, []);

  const restartGame = useCallback(() => {
    setIsGameOver(false);
    setOutcome(null);
    gameEvents.emit(EVENTS.RESTART_GAME);
  }, []);

  return {
    outcome,
    isGameOver,
    playerHealth,
    enemyHealth,
    attachListeners,
    restartGame,
  };
}
