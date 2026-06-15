import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export const EVENTS = {
  ASSETS_LOADED:         'assetsLoaded',
  START_GAME:            'startGame',
  GAME_STARTED:          'gameStarted',
  GAME_OVER:             'gameOver',
  RESTART_GAME:          'restartGame',
  EXIT_TO_MENU:          'exitToMenu',
  PLAYER_HEALTH_CHANGED: 'playerHealthChanged',
} as const;
