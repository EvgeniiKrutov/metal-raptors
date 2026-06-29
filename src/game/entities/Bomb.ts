import Phaser from 'phaser';
import { BombConfig } from '../../types/game.types';

export class Bomb extends Phaser.Physics.Arcade.Image {
  readonly damage: number;
  readonly area: number;

  private readonly bombConfig: BombConfig;

  constructor(scene: Phaser.Scene, x: number, y: number, config: BombConfig) {
    super(scene, x, y, config.sprite);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.bombConfig = config;
    this.damage = config.damage;
    this.area   = config.area;

    const aspect = this.height / this.width;
    this.setDisplaySize(config.displayWidth, config.displayWidth * aspect);
    this.setOrigin(0.5, 0.5);
    this.setDepth(8);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(true);
    body.setCollideWorldBounds(false);
  }

  drop(angle: number, planeSpeed: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;

    const inertia = planeSpeed * this.bombConfig.inertia;
    body.setVelocity(Math.cos(angle) * inertia, Math.sin(angle) * inertia);
    body.setGravityY(this.bombConfig.gravity * this.bombConfig.mass);

    this.setRotation(angle);
  }

  faceVelocity(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    if (body.velocity.x !== 0 || body.velocity.y !== 0) {
      this.setRotation(Math.atan2(body.velocity.y, body.velocity.x));
    }
  }
}
