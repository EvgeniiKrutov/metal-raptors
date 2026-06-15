import Phaser from 'phaser';

export const gameEvents = new Phaser.Events.EventEmitter();

export const EVENTS = {
  ASSETS_LOADED:         'assetsLoaded',
  START_GAME:            'startGame',
  GAME_STARTED:          'gameStarted',
  GAME_OVER:             'gameOver',
  RESTART_GAME:          'restartGame',
  PLAYER_HEALTH_CHANGED: 'playerHealthChanged',
  ENEMY_HEALTH_CHANGED:  'enemyHealthChanged',
} as const;
