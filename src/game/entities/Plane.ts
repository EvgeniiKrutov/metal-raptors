import Phaser from 'phaser';
import { PlaneConfig } from '../../types/game.types';

export abstract class Plane extends Phaser.Physics.Arcade.Sprite {
  planeConfig: PlaneConfig;

  currentSpeed: number = 0;
  verticalDrift: number = 0;

  currentHealth: number;
  maxHealth: number;

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
