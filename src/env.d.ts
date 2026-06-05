/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GAME_WIDTH: string;
  readonly VITE_GAME_HEIGHT: string;
  readonly VITE_WORLD_WIDTH: string;
  readonly VITE_WORLD_HEIGHT: string;
  readonly VITE_GRAVITY: string;
  readonly VITE_DRAG_COEFFICIENT: string;
  readonly VITE_LIFT_COEFFICIENT: string;
  readonly VITE_STALL_SPEED: string;
  readonly VITE_STALL_ROTATION_RATE: string;
  readonly VITE_PLAYER_SPRITE: string;
  readonly VITE_PLAYER_WIDTH: string;
  readonly VITE_PLAYER_MAX_SPEED: string;
  readonly VITE_PLAYER_MIN_SPEED: string;
  readonly VITE_PLAYER_ACCELERATION: string;
  readonly VITE_PLAYER_BRAKING: string;
  readonly VITE_PLAYER_TURN_SPEED: string;
  readonly VITE_PLAYER_WEIGHT: string;
  readonly VITE_PLAYER_HEALTH: string;
  readonly VITE_PLAYER_DAMAGE: string;
  readonly VITE_PLAYER_FIRE_RATE: string;
  readonly VITE_ENEMY_SPRITE: string;
  readonly VITE_ENEMY_WIDTH: string;
  readonly VITE_ENEMY_HEALTH: string;
  readonly VITE_ENEMY_WEIGHT: string;
  readonly VITE_BULLET_SPEED: string;
  readonly VITE_BULLET_WIDTH: string;
  readonly VITE_BULLET_HEIGHT: string;
  readonly VITE_CAMERA_LERP: string;
  readonly VITE_PARALLAX_BG_FACTOR: string;
  readonly VITE_PARALLAX_FG_FACTOR: string;
  readonly VITE_PARALLAX_GROUND_FACTOR: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
