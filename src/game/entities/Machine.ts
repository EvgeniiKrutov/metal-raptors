import Phaser from 'phaser';
import { MachineConfig } from '../../types/game.types';
import { Damageable } from '../systems/CombatSystem';

export class Machine extends Phaser.Physics.Arcade.Sprite implements Damageable {
  machineConfig: MachineConfig;

  currentHealth: number;
  maxHealth: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    config: MachineConfig,
  ) {
    super(scene, x, y, config.sprite);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.machineConfig = config;
    this.currentHealth = config.health;
    this.maxHealth     = config.health;

    const aspect = this.height / this.width;
    const displayHeight = config.displayWidth * aspect;

    this.setDisplaySize(config.displayWidth, displayHeight);
    this.setOrigin(0.5, 1);
    this.setFlipX(true);
    this.setDepth(5);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setCollideWorldBounds(false);
  }

  drive(dt: number, groundYAt: (x: number) => number): void {
    this.x -= this.machineConfig.speed * dt;
    this.y = groundYAt(this.x);
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
