import Phaser from 'phaser';
import { PlaneConfig } from '../../types/game.types';
import { Plane } from './Plane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { gameConfig } from '../config/gameConfig';
import { degToRad } from '../utils/helpers';

interface Keys {
  up:    boolean;
  down:  boolean;
  left:  boolean;
  right: boolean;
  fire:  boolean;
}

export class PlayerPlane extends Plane {
  private fireCooldown: number = 0;
  private isThrottlingUp: boolean = false;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PlaneConfig) {
    super(scene, x, y, 'player', config);
    this.setRotation(0);
  }

  handleInput(keys: Keys, delta: number): void {
    const dt  = delta / 1000;
    const cfg = this.planeConfig;

    const prevSpeed = this.currentSpeed;

    if (keys.up) {
      this.currentSpeed += cfg.acceleration * dt;
    } else if (keys.down) {
      this.currentSpeed -= cfg.braking * dt;
    } else {
      this.currentSpeed -= this.currentSpeed * gameConfig.physics.dragCoefficient;
    }
    this.currentSpeed = Math.max(0, Math.min(cfg.maxSpeed, this.currentSpeed));

    this.isThrottlingUp = keys.up && this.currentSpeed > prevSpeed;

    const turnRad = degToRad(cfg.turnSpeed) * dt;
    if (keys.left)  this.rotation -= turnRad;
    if (keys.right) this.rotation += turnRad;

    this.fireCooldown -= delta;
    if (keys.fire && this.fireCooldown <= 0) {
      this.fireCooldown = 1000 / cfg.fireRate;
      const angle = this.rotation;
      const halfLen = this.displayWidth / 2;
      const bx = this.x + Math.cos(angle) * halfLen;
      const by = this.y + Math.sin(angle) * halfLen;
      this.emit('fire', bx, by, angle);
      this.spawnGunTrace();
    }
  }

  updatePhysics(delta: number): void {
    const isThrottlingUp = this.isThrottlingUp || false;
    PhysicsSystem.updateFlight(this, delta, isThrottlingUp);
  }
}
