import Phaser from 'phaser';
import { Plane } from '../entities/Plane';
import { gameConfig } from '../config/gameConfig';
import { SoundsConfig } from '../../types/game.types';
import { degToRad } from '../utils/helpers';

type VolumeSound = Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound;

type EngineState = 'IDLE' | 'THROTTLE';

interface EngineController {
  targetAttenuation: number;
  update(delta: number): void;
  destroy(fade: boolean, onDone?: () => void): void;
}

class EngineSoundController implements EngineController {
  targetAttenuation = 1;

  private scene: Phaser.Scene;
  private plane: Plane;
  private roleFactor: number;
  private config: SoundsConfig;

  private idle: VolumeSound;
  private throttles = new Map<string, VolumeSound>();
  private activeThrottle: VolumeSound | null = null;
  private activeThrottleKey = '';

  private state: EngineState = 'IDLE';
  private idleLevel = 0;
  private throttleLevel = 0;
  private graceMs = 0;
  private attenuation: number;
  private destroyed = false;

  constructor(scene: Phaser.Scene, plane: Plane, roleFactor: number, config: SoundsConfig) {
    this.scene = scene;
    this.plane = plane;
    this.roleFactor = roleFactor;
    this.config = config;
    this.attenuation = this.targetAttenuation;

    this.idle = scene.sound.add('engine_idle', { loop: true, volume: 0 }) as VolumeSound;
    this.idle.play();

    scene.tweens.add({
      targets: this,
      idleLevel: 1,
      duration: config.engine.spawnFadeInMs,
    });
  }

  update(delta: number): void {
    if (this.destroyed) return;

    if (this.isManeuvering()) {
      this.graceMs = this.config.engine.throttleGraceMs;
      if (this.state === 'IDLE') this.enterThrottle();
    } else if (this.state === 'THROTTLE') {
      this.graceMs -= delta;
      if (this.graceMs <= 0) this.enterIdle();
    }

    const smoothing = 1 - Math.exp(-this.config.engine.attenuationSmoothing * (delta / 1000));
    this.attenuation += (this.targetAttenuation - this.attenuation) * smoothing;

    this.applyVolumes();
  }

  destroy(fade: boolean, onDone?: () => void): void {
    if (this.destroyed) return;
    this.scene.tweens.killTweensOf(this);

    if (!fade) {
      this.finalize();
      onDone?.();
      return;
    }

    this.scene.tweens.add({
      targets: this,
      idleLevel: 0,
      throttleLevel: 0,
      duration: this.config.engine.crossfadeMs,
      onUpdate: () => this.applyVolumes(),
      onComplete: () => {
        this.finalize();
        onDone?.();
      },
    });
  }

  private finalize(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.idle.destroy();
    for (const sound of this.throttles.values()) sound.destroy();
    this.throttles.clear();
    this.activeThrottle = null;
  }

  private isManeuvering(): boolean {
    const engine = this.config.engine;
    const maxRate = degToRad(this.plane.planeConfig.turnSpeed);
    const turning = Math.abs(this.plane.angularVelocity) > maxRate * engine.turnRateThreshold;
    const climbing = Math.sin(this.plane.rotation) < -Math.sin(degToRad(engine.climbAngleDeg));
    return turning || climbing;
  }

  private enterThrottle(): void {
    this.state = 'THROTTLE';

    const key = Phaser.Utils.Array.GetRandom(this.config.pools.engineThrottle);
    if (this.activeThrottle && this.activeThrottleKey !== key) {
      this.activeThrottle.stop();
    }

    let sound = this.throttles.get(key);
    if (!sound) {
      sound = this.scene.sound.add(key, { loop: true, volume: 0 }) as VolumeSound;
      this.throttles.set(key, sound);
    }
    if (!sound.isPlaying) sound.play();

    this.activeThrottle = sound;
    this.activeThrottleKey = key;
    this.transition('throttleLevel', 'idleLevel');
  }

  private enterIdle(): void {
    this.state = 'IDLE';
    this.transition('idleLevel', 'throttleLevel', () => {
      this.activeThrottle?.stop();
    });
  }

  private transition(
    fadeInLevel: 'idleLevel' | 'throttleLevel',
    fadeOutLevel: 'idleLevel' | 'throttleLevel',
    onComplete?: () => void,
  ): void {
    this.scene.tweens.killTweensOf(this);
    const duration = this.config.engine.crossfadeMs;

    this.scene.tweens.add({
      targets: this,
      [fadeInLevel]: 1,
      duration,
      onComplete: () => {
        this.scene.tweens.add({
          targets: this,
          [fadeOutLevel]: 0,
          duration,
          onComplete,
        });
      },
    });
  }

  private applyVolumes(): void {
    const library = this.config.library;
    const base = this.roleFactor * this.attenuation;
    this.idle.setVolume(library['engine_idle'].volume * base * this.idleLevel);
    if (this.activeThrottle) {
      this.activeThrottle.setVolume(library[this.activeThrottleKey].volume * base * this.throttleLevel);
    }
  }
}

class EnemyEngineSoundController implements EngineController {
  targetAttenuation = 1;

  private scene: Phaser.Scene;
  private config: SoundsConfig;

  private throttle: VolumeSound;
  private throttleKey: string;

  private level = 0;
  private attenuation: number;
  private destroyed = false;

  constructor(scene: Phaser.Scene, config: SoundsConfig) {
    this.scene = scene;
    this.config = config;
    this.attenuation = this.targetAttenuation;

    this.throttleKey = Phaser.Utils.Array.GetRandom(config.pools.engineThrottle);
    this.throttle = scene.sound.add(this.throttleKey, { loop: true, volume: 0 }) as VolumeSound;
    this.throttle.play();

    scene.tweens.add({
      targets: this,
      level: 1,
      duration: config.engine.spawnFadeInMs,
    });
  }

  update(delta: number): void {
    if (this.destroyed) return;

    const smoothing = 1 - Math.exp(-this.config.engine.attenuationSmoothing * (delta / 1000));
    this.attenuation += (this.targetAttenuation - this.attenuation) * smoothing;

    this.applyVolume();
  }

  destroy(fade: boolean, onDone?: () => void): void {
    if (this.destroyed) return;
    this.scene.tweens.killTweensOf(this);

    if (!fade) {
      this.finalize();
      onDone?.();
      return;
    }

    this.scene.tweens.add({
      targets: this,
      level: 0,
      duration: this.config.engine.crossfadeMs,
      onUpdate: () => this.applyVolume(),
      onComplete: () => {
        this.finalize();
        onDone?.();
      },
    });
  }

  private finalize(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.throttle.destroy();
  }

  private applyVolume(): void {
    this.throttle.setVolume(this.config.engine.enemyThrottleMaxVolume * this.attenuation * this.level);
  }
}

export class SoundSystem {
  private scene: Phaser.Scene;
  private worldWidth: number;
  private config: SoundsConfig;

  private player: Plane | null = null;
  private playerEngine: EngineSoundController | null = null;
  private enemyEngines = new Map<Plane, EngineController>();
  private dying = new Set<EngineController>();

  private wind: VolumeSound | null = null;
  private stutter: VolumeSound | null = null;
  private gameOver = false;

  constructor(scene: Phaser.Scene, worldWidth: number) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.config = gameConfig.sounds;

    scene.events.on(Phaser.Scenes.Events.PAUSE, this.handleScenePause, this);
    scene.events.on(Phaser.Scenes.Events.RESUME, this.handleSceneResume, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  start(player: Plane): void {
    this.player = player;
    this.playerEngine = new EngineSoundController(this.scene, player, 1, this.config);

    this.wind = this.scene.sound.add('ambient_wind', {
      loop: true,
      volume: this.config.library['ambient_wind'].volume,
    }) as VolumeSound;
    this.wind.play();

    this.stutter = this.scene.sound.add('engine_stutter', {
      volume: this.config.library['engine_stutter'].volume,
    }) as VolumeSound;
  }

  update(delta: number, enemies: Plane[]): void {
    if (this.gameOver) return;
    this.playerEngine?.update(delta);
    this.syncEnemyEngines(enemies);
    this.updateEnemyEngines(delta);
  }

  playExplosion(): void {
    const key = Phaser.Utils.Array.GetRandom(this.config.pools.explosion);
    this.scene.sound.play(key, { volume: this.config.library[key].volume });
  }

  playShot(): void {
    this.scene.sound.play('bullet_shot', { volume: this.config.library['bullet_shot'].volume });
  }

  playStutter(): void {
    if (!this.stutter || this.stutter.isPlaying) return;
    this.stutter.play();
  }

  enterGameOver(): void {
    if (this.gameOver) return;
    this.gameOver = true;

    if (this.playerEngine) {
      this.retire(this.playerEngine);
      this.playerEngine = null;
    }
    for (const controller of this.enemyEngines.values()) {
      this.retire(controller);
    }
    this.enemyEngines.clear();
  }

  private syncEnemyEngines(enemies: Plane[]): void {
    const active = new Set<Plane>();
    for (const enemy of enemies) {
      if (enemy.isAlive() && !enemy.isCrashing) active.add(enemy);
    }

    for (const [plane, controller] of this.enemyEngines) {
      if (!active.has(plane)) {
        this.retire(controller);
        this.enemyEngines.delete(plane);
      }
    }

    for (const plane of active) {
      if (!this.enemyEngines.has(plane)) {
        this.enemyEngines.set(
          plane,
          new EnemyEngineSoundController(this.scene, this.config),
        );
      }
    }
  }

  private updateEnemyEngines(delta: number): void {
    const engine = this.config.engine;

    const entries = [...this.enemyEngines.entries()].map(([plane, controller]) => ({
      controller,
      distance: this.distanceToPlayer(plane),
    }));
    entries.sort((a, b) => a.distance - b.distance);

    entries.forEach((entry, index) => {
      entry.controller.targetAttenuation =
        index < engine.maxAudibleEnemyEngines ? this.attenuationFor(entry.distance) : 0;
      entry.controller.update(delta);
    });
  }

  private attenuationFor(distance: number): number {
    const { enemyFadeStartDistance, enemyFadeEndDistance } = this.config.engine;
    if (distance <= enemyFadeStartDistance) return 1;
    if (distance >= enemyFadeEndDistance) return 0;
    return 1 - (distance - enemyFadeStartDistance) / (enemyFadeEndDistance - enemyFadeStartDistance);
  }

  private distanceToPlayer(plane: Plane): number {
    if (!this.player) return Number.MAX_VALUE;
    let dx = Math.abs(plane.x - this.player.x);
    if (this.worldWidth > 0) dx = Math.min(dx, this.worldWidth - dx);
    return Math.hypot(dx, plane.y - this.player.y);
  }

  private retire(controller: EngineController): void {
    this.dying.add(controller);
    controller.destroy(true, () => this.dying.delete(controller));
  }

  private handleScenePause(): void {
    if (this.gameOver) {
      this.wind?.stop();
      return;
    }
    this.scene.sound.pauseAll();
  }

  private handleSceneResume(): void {
    if (this.gameOver) return;
    this.scene.sound.resumeAll();
  }

  private shutdown(): void {
    this.scene.events.off(Phaser.Scenes.Events.PAUSE, this.handleScenePause, this);
    this.scene.events.off(Phaser.Scenes.Events.RESUME, this.handleSceneResume, this);

    this.playerEngine?.destroy(false);
    this.playerEngine = null;

    for (const controller of this.enemyEngines.values()) {
      controller.destroy(false);
    }
    this.enemyEngines.clear();

    for (const controller of this.dying) {
      controller.destroy(false);
    }
    this.dying.clear();

    this.wind?.destroy();
    this.wind = null;
    this.stutter?.destroy();
    this.stutter = null;
  }
}
