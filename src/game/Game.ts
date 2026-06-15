import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export const EVENTS = {
  ASSETS_LOADED:         'assetsLoaded',
  START_GAME:            'startGame',
  GAME_STARTED:          'gameStarted',
  GAME_OVER:             'gameOver',
  GAME_PAUSED:           'gamePaused',
  RESUME_GAME:           'resumeGame',
  RESTART_GAME:          'restartGame',
  EXIT_TO_MENU:          'exitToMenu',
  PLAYER_HEALTH_CHANGED: 'playerHealthChanged',
} as const;
