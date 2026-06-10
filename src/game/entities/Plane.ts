import Phaser from 'phaser';
import { PlaneConfig } from '../../types/game.types';

const SMOKE_HEALTH_THRESHOLD = 0.3;

const CRASH_GRAVITY      = 900;
const CRASH_INITIAL_FALL = 60;

export abstract class Plane extends Phaser.Physics.Arcade.Sprite {
  planeConfig: PlaneConfig;

  currentSpeed: number = 0;
  verticalDrift: number = 0;

  currentHealth: number;
  maxHealth: number;

  isCrashing: boolean = false;
  private crashVx = 0;
  private crashVy = 0;
  private crashSpin = 0;

  private smokeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter;
  private smokeFrequency = -1;
  private smokeTint = -1;

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

    this.currentSpeed = config.maxSpeed * 0.7;

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

    const body = this.body as Phaser.Physics.Arcade.Body | undefined;
    if (body) body.enable = false;
  }

  destroy(fromScene?: boolean): void {
    this.smokeEmitter?.destroy();
    this.smokeEmitter = undefined;
    super.destroy(fromScene);
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
