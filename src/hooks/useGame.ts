import { useState, useCallback, useEffect } from 'react';
import { GameOutcome } from '../types/game.types';
import { gameEvents, EVENTS } from '../game/Game';
import { getCompleted, markCompleted } from '../game/utils/progress';
import { isMusicEnabled, setMusicEnabled } from '../game/utils/musicPreference';
import { authenticateGameCenter } from '../services/gameCenter';
import { getStubPlayerId, fetchPlayerProfile } from '../services/player';

export function useGame() {
  const [outcome, setOutcome] = useState<GameOutcome>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const [isReady, setIsReady]     = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const [playerHealth, setPlayerHealth] = useState({ current: 100, max: 100 });

  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => getCompleted());
  const [musicEnabled, setMusicEnabledState] = useState<boolean>(() => isMusicEnabled());

  const [playerResolved, setPlayerResolved] = useState(false);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    authenticateGameCenter()
      .then((res) => {
        const id = res.userId ?? getStubPlayerId();
        if (!cancelled) setPlayerId(id);
        return fetchPlayerProfile(id);
      })
      .then((profile) => {
        if (cancelled) return;
        setUsername(profile.username);
        setPlayerResolved(true);
      })
      .catch(() => {
        if (cancelled) return;
        setUsername('error');
        setPlayerResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

    gameEvents.on(EVENTS.GAME_PAUSED, () => {
      setIsPaused(true);
    });
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

  const resumeGame = useCallback(() => {
    setIsPaused(false);
    gameEvents.emit(EVENTS.RESUME_GAME);
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicEnabledState((prev) => {
      const next = !prev;
      setMusicEnabled(next);
      gameEvents.emit(EVENTS.TOGGLE_MUSIC, { enabled: next });
      return next;
    });
  }, []);

  const exitToMenu = useCallback(() => {
    setIsGameOver(false);
    setOutcome(null);
    setIsPaused(false);
    setIsStarted(false);
    gameEvents.emit(EVENTS.EXIT_TO_MENU);
  }, []);

  return {
    outcome,
    isGameOver,
    isPaused,
    isReady,
    isStarted,
    playerHealth,
    completed,
    selectedLevelId,
    playerResolved,
    playerId,
    username,
    musicEnabled,
    attachListeners,
    startGame,
    restartGame,
    resumeGame,
    toggleMusic,
    exitToMenu,
  };
}
