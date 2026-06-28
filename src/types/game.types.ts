export interface PlaneConfig {
  sprite: string;
  width: number;
  maxSpeed: number;
  turnSpeed: number;
  mass: number;
  health: number;
  damage: number;
  fireRate: number;
}

export interface EnemyBehaviorConfig {
  id: string;
  name: string;

  stats: {
    sprite: string;
    width: number;
    health: number;
    damage: number;
    fireRate: number;
  };

  flight: {
    maxSpeed: number;
    turnSpeed: number;
    mass: number;
  };

  ai: {
    targeting: {
      fireAngleThreshold: number;
      leadFactor: number;
      maxFireRange: number;
    };

    groundAvoidance: {
      minAltitudeMargin: number;
      safeAltitudeMargin: number;
    };

    attack: {
      durationMs: number;
    };

    fly: {
      durationMs: number;
      targetYFactor: number;
      weaveAmplitude: number;
      weaveHz: number;
    };

    evasion: {
      threatRadius: number;
      threatMissDistance: number;
      durationMs: number;
      jitterAmplitude: number;
      jitterHz: number;
    };
  };
}

export interface PhysicsConfig {
  turnResponsiveness: number;
}

export interface BulletConfig {
  speed: number;
  width: number;
  height: number;
}

export interface ParallaxLayerConfig {
  key: string;
  depth: number;
  parallaxFactor: number;
}

export interface SpawnConfig {
  ringMargin: number;
  ringJitter: number;
  minCeilingMargin: number;
  minGroundMargin: number;
  startDelayMs: number;
}

export interface StageEnemyGroup {
  type: string;
  count: number;
}

export interface StageConfig {
  maxConcurrent: number;
  enemies: StageEnemyGroup[];
}

export interface LevelConfig {
  id: string;
  name: string;
  background: string;
  backgroundVariant: string;
  stages: StageConfig[];
}

export interface GameConfigData {
  display: { width: number; height: number };
  world:   { width: number; height: number };
  physics: PhysicsConfig;
  player:  PlaneConfig;
  enemy:   PlaneConfig;
  bullet:  BulletConfig;
  camera:  { lerp: number; zoom: number };
  parallax: ParallaxLayerConfig[];
  spawn:    SpawnConfig;
}

export interface SectionLevelRef {
  id: string;
  name: string;
}

export interface SectionConfig {
  id: string;
  name: string;
  sceneKey: string;
  levels: SectionLevelRef[];
}

export interface BattlefieldWorldConfig {
  tileWidth: number;
  tileHeight: number;
  widthTiles: number;
  camera: { lerp: number; zoom: number };
  ceiling: number;
  planeScale: number;
  planeSpeed: number;
}

export interface GroundPoint {
  x: number;
  y: number;
}

export interface GroundCurveConfig {
  points: GroundPoint[];
}

export interface MachineConfig {
  id: string;
  name: string;
  sprite: string;
  displayWidth: number;
  health: number;
  speed: number;
}

export interface BattlefieldStageGroup {
  type: string;
  count: number;
}

export interface BattlefieldStageConfig {
  maxConcurrent: number;
  enemies: BattlefieldStageGroup[];
}

export interface BattlefieldLevelConfig {
  id: string;
  name: string;
  section: 'battlefield';
  map: string;
  ground: GroundCurveConfig;
  stages: BattlefieldStageConfig[];
}

export type GameState   = 'INIT' | 'LOADING' | 'PLAYING' | 'GAME_OVER';
export type GameOutcome = 'VICTORY' | 'DEFEAT' | null;

/** Abstract movement/fire intent, decoupled from the input device (keys or joystick). */
export interface ControlState {
  left:  boolean;
  right: boolean;
  fire:  boolean;
  targetHeading?: number;
}
