import Phaser from 'phaser';
import { PlaneConfig } from '../../types/game.types';
import { gameConfig } from '../config/gameConfig';
import { GUN_TRACE_COUNT, gunTraceKey, degToRad } from '../utils/helpers';

const SMOKE_HEALTH_THRESHOLD = 0.3;

const CRASH_GRAVITY      = 900;
const CRASH_INITIAL_FALL = 60;

const GUN_TRACE_LIFETIME      = 90;
const GUN_TRACE_LENGTH_FACTOR = 0.45;
const GUN_TRACE_OFFSET_FACTOR = 0.4;

export abstract class Plane extends Phaser.Physics.Arcade.Sprite {
  planeConfig: PlaneConfig;

  currentSpeed: number = 0;
  angularVelocity: number = 0;

  currentHealth: number;
  maxHealth: number;

  isCrashing: boolean = false;
  private crashVx = 0;
  private crashVy = 0;
  private crashSpin = 0;

  private smokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeFrequency = -1;
  private smokeTint = -1;

  private gunTraces: Phaser.GameObjects.Sprite[] = [];

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    config: PlaneConfig,
  ) {
    super(scene, x, y, textureKey);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.planeConfig = config;
    this.currentHealth = config.health;
    this.maxHealth     = config.health;

    this.currentSpeed = config.maxSpeed;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
    body.setMaxVelocity(2000, 2000);

    this.setDepth(10);
    this.setOrigin(0.5, 0.5);

    this.createSmoke();
  }

  private createSmoke(): void {
    this.smokeEmitter = this.scene.add.particles(0, 0, 'smoke', {
      speed:    { min: 5,  max: 30 },
      angle:    { min: 0,  max: 360 },
      lifespan: { min: 600, max: 1000 },
      scale:    { start: 0.1, end: 0.5 },
      alpha:    { start: 0.8, end: 0 },
      rotate:   { min: 0, max: 360 },
      tint:     [0x888888, 0x555555, 0x333333],
      frequency: 60,
      quantity:  1,
    });

    this.smokeEmitter.setDepth(this.depth - 1);
    this.smokeEmitter.startFollow(this);
    this.smokeEmitter.stop();
  }

  updateSmoke(): void {
    if (!this.smokeEmitter) return;

    const pct = this.getHealthPercent();

    if (this.isAlive() && pct <= SMOKE_HEALTH_THRESHOLD) {
      if (!this.smokeEmitter.emitting) {
        this.smokeEmitter.start();
      }

      const t = Phaser.Math.Clamp(1 - pct / SMOKE_HEALTH_THRESHOLD, 0, 1);

      const frequency = Math.round(Phaser.Math.Linear(55, 18, t));
      if (frequency !== this.smokeFrequency) {
        this.smokeEmitter.setFrequency(frequency);
        this.smokeFrequency = frequency;
      }

      const tint = t > 0.6 ? 0x222222 : 0x666666;
      if (tint !== this.smokeTint) {
        this.smokeEmitter.setParticleTint(tint);
        this.smokeTint = tint;
      }
    } else if (this.smokeEmitter.emitting) {
      this.smokeEmitter.stop();
      this.smokeFrequency = -1;
      this.smokeTint = -1;
    }
  }

  protected spawnGunTrace(): void {
    const key   = gunTraceKey(Phaser.Math.Between(1, GUN_TRACE_COUNT));
    const trace = this.scene.add.sprite(0, 0, key);

    trace.setOrigin(0, 0.5);
    trace.setDepth(this.depth + 1);
    trace.setScale((this.displayWidth * GUN_TRACE_LENGTH_FACTOR) / trace.width);

    this.positionGunTrace(trace);
    this.gunTraces.push(trace);

    this.scene.tweens.add({
      targets: trace,
      alpha: { from: 1, to: 0 },
      duration: GUN_TRACE_LIFETIME,
      onUpdate: () => this.positionGunTrace(trace),
      onComplete: () => this.removeGunTrace(trace),
    });
  }

  private positionGunTrace(trace: Phaser.GameObjects.Sprite): void {
    const offset = this.displayWidth * GUN_TRACE_OFFSET_FACTOR;
    trace.setPosition(
      this.x + Math.cos(this.rotation) * offset,
      this.y + Math.sin(this.rotation) * offset,
    );
    trace.setRotation(this.rotation);
  }

  private removeGunTrace(trace: Phaser.GameObjects.Sprite): void {
    const idx = this.gunTraces.indexOf(trace);
    if (idx >= 0) this.gunTraces.splice(idx, 1);
    trace.destroy();
  }

  private clearGunTraces(): void {
    for (const trace of this.gunTraces) {
      this.scene.tweens.killTweensOf(trace);
      trace.destroy();
    }
    this.gunTraces.length = 0;
  }

  startCrash(): void {
    if (this.isCrashing) return;
    this.isCrashing = true;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.enable = false;

    this.crashVx   = Math.cos(this.rotation) * this.currentSpeed * 0.3;
    this.crashVy   = CRASH_INITIAL_FALL;
    this.crashSpin = (Math.random() < 0.5 ? -1 : 1) * Phaser.Math.FloatBetween(2, 4);

    if (this.smokeEmitter) {
      this.smokeEmitter.setFrequency(20);
      this.smokeEmitter.setParticleTint(0x222222);
      this.smokeEmitter.start();
    }
  }

  updateCrash(delta: number, groundY: number): boolean {
    if (!this.isCrashing) return false;

    const dt = delta / 1000;
    this.crashVy  += CRASH_GRAVITY * dt;
    this.x        += this.crashVx * dt;
    this.y        += this.crashVy * dt;
    this.rotation += this.crashSpin * dt;

    if (this.y >= groundY) {
      this.y = groundY;
      return true;
    }
    return false;
  }

  hideWreck(): void {
    this.setVisible(false);
    this.smokeEmitter?.stop();
    this.clearGunTraces();

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;
  }

  destroy(fromScene?: boolean): void {
    this.smokeEmitter?.destroy();
    this.smokeEmitter = undefined;
    this.clearGunTraces();
    super.destroy(fromScene);
  }

  applyTurnRate(desiredRate: number, dt: number): void {
    const phys     = gameConfig.physics;
    const approach = 1 - Math.exp(-(phys.turnResponsiveness / this.planeConfig.mass) * dt);
    this.angularVelocity += (desiredRate - this.angularVelocity) * approach;
    this.rotation = Phaser.Math.Angle.Wrap(this.rotation + this.angularVelocity * dt);
  }

  steerToHeading(targetHeading: number, dt: number): void {
    const maxRate     = degToRad(this.planeConfig.turnSpeed);
    const error       = Phaser.Math.Angle.Wrap(targetHeading - this.rotation);
    const desiredRate = Phaser.Math.Clamp(dt > 0 ? error / dt : 0, -maxRate, maxRate);
    this.applyTurnRate(desiredRate, dt);
  }

  takeDamage(amount: number): boolean {
    this.currentHealth = Math.max(0, this.currentHealth - amount);
    return this.currentHealth <= 0;
  }

  getHealthPercent(): number {
    return this.currentHealth / this.maxHealth;
  }

  isAlive(): boolean {
    return this.currentHealth > 0;
  }
}
