import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';

export class Bullet extends Phaser.Physics.Arcade.Image {
  damage: number = 10;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'bullet');
    this.setDisplaySize(gameConfig.bullet.width, gameConfig.bullet.height);
    this.setActive(false).setVisible(false);
  }

  fire(x: number, y: number, angle: number, speed: number, damage: number): void {    this.setActive(true).setVisible(true);
    this.setPosition(x, y);
    this.setRotation(angle);
    this.damage = damage;

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.reset(x, y);
    body.setVelocity(
      Math.cos(angle) * speed,
      Math.sin(angle) * speed,
    );
    body.setAllowGravity(false);
  }

  deactivate(): void {
    this.setActive(false).setVisible(false);
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
  }
}
