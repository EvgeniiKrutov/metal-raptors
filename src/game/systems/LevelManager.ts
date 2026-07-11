import Phaser from 'phaser';
import { EnemyBehaviorConfig, LevelConfig } from '../../types/game.types';
import { gameConfig } from '../config/gameConfig';
import { EnemyPlane } from '../entities/EnemyPlane';
import { KamikazePlane } from '../entities/KamikazePlane';
import { createEnemyPlane } from '../entities/createEnemyPlane';
import { PlayerPlane } from '../entities/PlayerPlane';
import { InterpolationSystem } from './InterpolationSystem';
import { getEnemyBehavior } from '../config/data/enemies/index';
import { degToRad } from '../utils/helpers';

export interface LevelManagerCallbacks {
  onSpawn?: (enemy: EnemyPlane) => void;
  onStageChanged?: (stageIndex: number, totalStages: number) => void;
  onLevelCompleted: () => void;
}

export class LevelManager {
  private scene: Phaser.Scene;
  private level: LevelConfig;
  private player: PlayerPlane;
  private interpolation: InterpolationSystem;
  private callbacks: LevelManagerCallbacks;

  private stageIndex: number = 0;
  private spawnQueue: string[] = [];
  private activeEnemies: EnemyPlane[] = [];
  private completed: boolean = false;
  private elapsedMs: number = 0;

  constructor(
    scene: Phaser.Scene,
    level: LevelConfig,
    player: PlayerPlane,
    interpolation: InterpolationSystem,
    callbacks: LevelManagerCallbacks,
  ) {
    this.scene = scene;
    this.level = level;
    this.player = player;
    this.interpolation = interpolation;
    this.callbacks = callbacks;
  }

  start(): void {
    this.stageIndex = 0;
    this.completed = false;
    this.elapsedMs = 0;
    this.buildQueueForCurrentStage();
    this.callbacks.onStageChanged?.(this.stageIndex, this.level.stages.length);
  }

  update(delta: number): void {
    if (this.completed) return;

    this.elapsedMs += delta;
    if (this.elapsedMs < gameConfig.spawn.startDelayMs) return;

    this.pruneDeadEnemies();
    this.spawnIfNeeded();

    while (this.spawnQueue.length === 0 && this.activeEnemies.length === 0) {
      if (this.stageIndex >= this.level.stages.length - 1) {
        this.completed = true;
        this.callbacks.onLevelCompleted();
        return;
      }

      this.stageIndex += 1;
      this.buildQueueForCurrentStage();
      this.callbacks.onStageChanged?.(this.stageIndex, this.level.stages.length);
      this.spawnIfNeeded();
    }
  }

  getActiveEnemies(): EnemyPlane[] {
    return this.activeEnemies;
  }

  getStageIndex(): number {
    return this.stageIndex;
  }

  getTotalStages(): number {
    return this.level.stages.length;
  }

  getRemainingCount(): number {
    return this.spawnQueue.length + this.activeEnemies.length;
  }

  removeEnemy(enemy: EnemyPlane): void {
    const i = this.activeEnemies.indexOf(enemy);
    if (i === -1) return;
    this.activeEnemies.splice(i, 1);
    this.interpolation.unregister(enemy);
  }

  private pruneDeadEnemies(): void {
    for (let i = this.activeEnemies.length - 1; i >= 0; i--) {
      if (!this.activeEnemies[i].isAlive()) {
        this.interpolation.unregister(this.activeEnemies[i]);
        this.activeEnemies.splice(i, 1);
      }
    }
  }

  private buildQueueForCurrentStage(): void {
    const stage = this.level.stages[this.stageIndex];
    this.spawnQueue = [];
    if (!stage) return;

    for (const group of stage.enemies) {
      for (let i = 0; i < group.count; i++) {
        this.spawnQueue.push(group.type);
      }
    }
  }

  private spawnIfNeeded(): void {
    const stage = this.level.stages[this.stageIndex];
    if (!stage) return;

    while (
      this.activeEnemies.length < stage.maxConcurrent &&
      this.spawnQueue.length > 0
    ) {
      const typeId = this.spawnQueue.shift() as string;
      this.spawnEnemy(typeId);
    }
  }

  private spawnEnemy(typeId: string): void {
    const behavior = getEnemyBehavior(typeId);
    const { x, y } = this.computeSpawnPoint(behavior);

    const enemy = createEnemyPlane(this.scene, x, y, behavior);
    enemy.setRotation(Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y));

    this.interpolation.register(enemy);
    enemy.on('fire', (bx: number, by: number, angle: number, damage: number) => {
      (this.scene as Phaser.Scene & {
        spawnEnemyBullet: (x: number, y: number, angle: number, damage: number) => void;
      }).spawnEnemyBullet(bx, by, angle, damage);
    });
    enemy.on('detonate', (kamikaze: KamikazePlane) => {
      (this.scene as Phaser.Scene & {
        onEnemyDetonated: (enemy: KamikazePlane) => void;
      }).onEnemyDetonated(kamikaze);
    });

    this.activeEnemies.push(enemy);
    this.callbacks.onSpawn?.(enemy);
  }

  private computeSpawnPoint(behavior: EnemyBehaviorConfig): { x: number; y: number } {
    const { world, spawn } = gameConfig;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;

    const ceiling = 20;
    const groundY = world.height - 80;

    const angle = this.computeSpawnAngle(behavior);
    const radius =
      Math.max(view.width, view.height) / 2 +
      spawn.ringMargin +
      Math.random() * spawn.ringJitter;

    let x = this.player.x + Math.cos(angle) * radius;
    const y = Phaser.Math.Clamp(
      this.player.y + Math.sin(angle) * radius,
      ceiling + spawn.minCeilingMargin,
      groundY - spawn.minGroundMargin,
    );

    if (x > view.left && x < view.right && y > view.top && y < view.bottom) {
      const offset = spawn.ringMargin + Math.random() * spawn.ringJitter;
      x = Math.cos(angle) >= 0 ? view.right + offset : view.left - offset;
    }

    x = ((x % world.width) + world.width) % world.width;

    return { x, y };
  }

  private computeSpawnAngle(behavior: EnemyBehaviorConfig): number {
    if (behavior.role !== 'kamikaze') {
      return Math.random() * Math.PI * 2;
    }

    const jitter = degToRad(behavior.ai.spawn.angleJitterDeg);
    return Phaser.Math.Angle.Wrap(
      this.player.rotation + Phaser.Math.FloatBetween(-jitter, jitter),
    );
  }
}
