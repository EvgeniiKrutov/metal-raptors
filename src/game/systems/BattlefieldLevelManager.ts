import Phaser from 'phaser';
import { BattlefieldLevelConfig } from '../../types/game.types';
import { gameConfig } from '../config/gameConfig';
import { EnemyPlane } from '../entities/EnemyPlane';
import { PlayerPlane } from '../entities/PlayerPlane';
import { Machine } from '../entities/Machine';
import { InterpolationSystem } from './InterpolationSystem';
import { TerrainSystem } from './TerrainSystem';
import { getEnemyBehavior } from '../config/data/enemies/index';
import { getMachine, isMachineType } from '../config/data/battlefield/machines/index';

export interface BattlefieldLevelManagerCallbacks {
  onSpawnEnemy?: (enemy: EnemyPlane) => void;
  onSpawnMachine?: (machine: Machine) => void;
  onStageChanged?: (stageIndex: number, totalStages: number) => void;
  onLevelCompleted: () => void;
}

export class BattlefieldLevelManager {
  private scene: Phaser.Scene;
  private level: BattlefieldLevelConfig;
  private player: PlayerPlane;
  private interpolation: InterpolationSystem;
  private terrain: TerrainSystem;
  private worldWidth: number;
  private ceiling: number;
  private planeScale: number;
  private enemySpeedScale: number;
  private callbacks: BattlefieldLevelManagerCallbacks;

  private stageIndex: number = 0;
  private spawnQueue: string[] = [];
  private activeEnemies: EnemyPlane[] = [];
  private activeMachines: Machine[] = [];
  private completed: boolean = false;
  private elapsedMs: number = 0;

  constructor(
    scene: Phaser.Scene,
    level: BattlefieldLevelConfig,
    player: PlayerPlane,
    interpolation: InterpolationSystem,
    terrain: TerrainSystem,
    worldWidth: number,
    ceiling: number,
    planeScale: number,
    enemySpeedScale: number,
    callbacks: BattlefieldLevelManagerCallbacks,
  ) {
    this.scene = scene;
    this.level = level;
    this.player = player;
    this.interpolation = interpolation;
    this.terrain = terrain;
    this.worldWidth = worldWidth;
    this.ceiling = ceiling;
    this.planeScale = planeScale;
    this.enemySpeedScale = enemySpeedScale;
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

    while (
      this.spawnQueue.length === 0 &&
      this.activeEnemies.length === 0 &&
      this.activeMachines.length === 0
    ) {
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

  updateMachines(delta: number): void {
    const dt = delta / 1000;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;
    const margin = 100;

    for (let i = this.activeMachines.length - 1; i >= 0; i--) {
      const machine = this.activeMachines[i];
      machine.drive(dt, (x) => this.terrain.groundYAt(x));

      const rightEdge = machine.x + machine.displayWidth / 2;
      if (rightEdge < view.left - margin) {
        this.removeMachine(machine);
      }
    }
  }

  getActiveEnemies(): EnemyPlane[] {
    return this.activeEnemies;
  }

  getActiveMachines(): Machine[] {
    return this.activeMachines;
  }

  getStageIndex(): number {
    return this.stageIndex;
  }

  getTotalStages(): number {
    return this.level.stages.length;
  }

  getRemainingCount(): number {
    return this.spawnQueue.length + this.activeEnemies.length + this.activeMachines.length;
  }

  removeEnemy(enemy: EnemyPlane): void {
    const i = this.activeEnemies.indexOf(enemy);
    if (i === -1) return;
    this.activeEnemies.splice(i, 1);
    this.interpolation.unregister(enemy);
  }

  removeMachine(machine: Machine): void {
    const i = this.activeMachines.indexOf(machine);
    if (i === -1) return;
    this.activeMachines.splice(i, 1);
    this.interpolation.unregister(machine);
    machine.destroy();
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
      this.activeEnemies.length + this.activeMachines.length < stage.maxConcurrent &&
      this.spawnQueue.length > 0
    ) {
      const typeId = this.spawnQueue.shift() as string;
      if (isMachineType(typeId)) {
        this.spawnMachine(typeId);
      } else {
        this.spawnEnemy(typeId);
      }
    }
  }

  private spawnEnemy(typeId: string): void {
    const behavior = getEnemyBehavior(typeId);
    const { x, y } = this.computeEnemySpawnPoint();

    const enemy = new EnemyPlane(this.scene, x, y, behavior);
    enemy.setScale(this.planeScale);
    enemy.setSmokeScale(this.planeScale);
    enemy.currentSpeed = behavior.flight.maxSpeed * this.enemySpeedScale;
    enemy.setRotation(Phaser.Math.Angle.Between(x, y, this.player.x, this.player.y));

    this.interpolation.register(enemy);
    enemy.on('fire', (bx: number, by: number, angle: number) => {
      (this.scene as Phaser.Scene & {
        spawnEnemyBullet: (x: number, y: number, angle: number) => void;
      }).spawnEnemyBullet(bx, by, angle);
    });

    this.activeEnemies.push(enemy);
    this.callbacks.onSpawnEnemy?.(enemy);
  }

  private spawnMachine(typeId: string): void {
    const config = getMachine(typeId);
    if (!config) return;

    const cam = this.scene.cameras.main;
    const spacing = config.displayWidth * 1.6;
    const stagger = this.activeMachines.length * spacing;
    const jitter = Math.random() * config.displayWidth * 0.5;
    const x = cam.worldView.right + config.displayWidth + stagger + jitter;
    const y = this.terrain.groundYAt(x);

    const machine = new Machine(this.scene, x, y, config);

    this.interpolation.register(machine);
    this.activeMachines.push(machine);
    this.callbacks.onSpawnMachine?.(machine);
  }

  private computeEnemySpawnPoint(): { x: number; y: number } {
    const { spawn } = gameConfig;
    const cam = this.scene.cameras.main;
    const view = cam.worldView;

    const angle = Math.random() * Math.PI * 2;
    const radius =
      Math.max(view.width, view.height) / 2 +
      spawn.ringMargin +
      Math.random() * spawn.ringJitter;

    let x = this.player.x + Math.cos(angle) * radius;
    let y = this.player.y + Math.sin(angle) * radius;

    const groundY = this.terrain.groundYAt(x);
    y = Phaser.Math.Clamp(
      y,
      this.ceiling + spawn.minCeilingMargin,
      groundY - spawn.minGroundMargin,
    );

    if (x > view.left && x < view.right && y > view.top && y < view.bottom) {
      const offset = spawn.ringMargin + Math.random() * spawn.ringJitter;
      x = Math.cos(angle) >= 0 ? view.right + offset : view.left - offset;
    }

    x = ((x % this.worldWidth) + this.worldWidth) % this.worldWidth;

    return { x, y };
  }
}
