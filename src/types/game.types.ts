export interface PlaneConfig {
  sprite: string;
  width: number;
  maxSpeed: number;
  turnSpeed: number;
  mass: number;
  health: number;
  damage: number;
  fireRate: number;
  bombCooldown?: number;
}

export type EnemyRole = 'fighter' | 'kamikaze' | 'heavy';

export interface EnemyStatsConfig {
  sprite: string;
  width: number;
  health: number;
  damage: number;
  fireRate: number;
}

export interface EnemyFlightConfig {
  maxSpeed: number;
  turnSpeed: number;
  mass: number;
}

export interface EnemyTargetingConfig {
  fireAngleThreshold: number;
  leadFactor: number;
  maxFireRange: number;
}

export interface EnemyGroundAvoidanceConfig {
  minAltitudeMargin: number;
  safeAltitudeMargin: number;
}

interface EnemyBehaviorBase {
  id: string;
  name: string;
  role: EnemyRole;
  stats: EnemyStatsConfig;
  flight: EnemyFlightConfig;
}

export interface FighterBehaviorConfig extends EnemyBehaviorBase {
  role: 'fighter';

  ai: {
    targeting: EnemyTargetingConfig;
    groundAvoidance: EnemyGroundAvoidanceConfig;

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

export interface KamikazeBehaviorConfig extends EnemyBehaviorBase {
  role: 'kamikaze';

  ai: {
    spawn: {
      angleJitterDeg: number;
    };

    groundAvoidance: EnemyGroundAvoidanceConfig;

    pursue: {
      durationMs: number;
      weaveAmplitudeDeg: number;
      weaveHz: number;
    };

    breakOff: {
      durationMs: number;
      headingJitterDeg: number;
    };

    blast: {
      triggerRadius: number;
      damageRadius: number;
    };
  };
}

export interface HeavyBehaviorConfig extends EnemyBehaviorBase {
  role: 'heavy';

  ai: {
    targeting: EnemyTargetingConfig;
    groundAvoidance: EnemyGroundAvoidanceConfig;

    pass: {
      maxClimbAngleDeg: number;
    };
  };
}

export type EnemyBehaviorConfig =
  | FighterBehaviorConfig
  | KamikazeBehaviorConfig
  | HeavyBehaviorConfig;

export interface PhysicsConfig {
  turnResponsiveness: number;
}

export interface BulletConfig {
  speed: number;
  width: number;
  height: number;
}

export interface BombConfig {
  sprite: string;
  displayWidth: number;
  mass: number;
  damage: number;
  area: number;
  gravity: number;
  inertia: number;
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
  music?: string;
  stages: StageConfig[];
}

export interface SoundDefinition {
  path: string;
  volume: number;
}

export interface EngineSoundConfig {
  crossfadeMs: number;
  throttleGraceMs: number;
  turnRateThreshold: number;
  climbAngleDeg: number;
  spawnFadeInMs: number;
  enemyThrottleMaxVolume: number;
  enemyFadeStartDistance: number;
  enemyFadeEndDistance: number;
  maxAudibleEnemyEngines: number;
  attenuationSmoothing: number;
}

export interface SoundsConfig {
  library: Record<string, SoundDefinition>;
  pools: {
    explosion: string[];
    engineThrottle: string[];
  };
  engine: EngineSoundConfig;
}

export type MusicWave = 'sine' | 'square' | 'triangle' | 'sawtooth' | 'noise';

export interface MusicTrackConfig {
  wave: MusicWave;
  volume: number;
  detune?: number;
  attack?: number;
  release?: number;
}

export type MusicNoteEvent = [string | number | null, number, number?];

export interface MusicConfig {
  id: string;
  name: string;
  tempo: number;
  volume: number;
  loopStart?: number;
  tracks: Record<string, MusicTrackConfig>;
  patterns: Record<string, Record<string, MusicNoteEvent[]>>;
  sequence: string[];
}

export interface GameConfigData {
  display: { width: number; height: number };
  world:   { width: number; height: number };
  physics: PhysicsConfig;
  player:  PlaneConfig;
  enemy:   PlaneConfig;
  bullet:  BulletConfig;
  bomb:    BombConfig;
  camera:  { lerp: number; zoom: number };
  parallax: ParallaxLayerConfig[];
  spawn:    SpawnConfig;
  sounds:   SoundsConfig;
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
  fallScale: number;
}

export interface GroundHarmonic {
  cos: number;
  sin: number;
}

export interface GroundCurveConfig {
  baseline: number;
  period: number;
  harmonics: GroundHarmonic[];
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
  music?: string;
  ground: GroundCurveConfig;
  stages: BattlefieldStageConfig[];
}

export interface RibbonConfig {
  segmentLength: number;
  maxSegments: number;
  width: number;
  color: string;
  sprite?: string;
}

export interface RibbonScoringConfig {
  maxPoints: number;
  minPoints: number;
}

export interface RibbonOpponentConfig {
  maxSpeed: number;
  turnSpeed: number;
  mass: number;
}

export interface RibbonLevelConfig {
  id: string;
  name: string;
  section: 'ribbon';
  background: string;
  backgroundVariant: string;
  music?: string;
  timeLimitMs?: number;
  ribbon: RibbonConfig;
  scoring: RibbonScoringConfig;
  opponent: RibbonOpponentConfig;
}

export type GameState   = 'INIT' | 'LOADING' | 'PLAYING' | 'GAME_OVER';
export type GameOutcome = 'VICTORY' | 'DEFEAT' | null;

/** Abstract movement/fire intent, decoupled from the input device (keys or joystick). */
export interface ControlState {
  left:  boolean;
  right: boolean;
  fire:  boolean;
  bomb?: boolean;
  targetHeading?: number;
}
