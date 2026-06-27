import Phaser from 'phaser';
import { PlaneConfig } from '../../types/game.types';
import { Plane } from './Plane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { degToRad } from '../utils/helpers';

interface Keys {
  left:  boolean;
  right: boolean;
  fire:  boolean;
  targetHeading?: number;
}

export class PlayerPlane extends Plane {
  private fireCooldown: number = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, config: PlaneConfig) {
    super(scene, x, y, 'player', config);
    this.setRotation(0);
  }

  handleInput(keys: Keys, delta: number): void {
    const dt  = delta / 1000;
    const cfg = this.planeConfig;

    if (keys.targetHeading !== undefined) {
      this.steerToHeading(keys.targetHeading, dt);
    } else {
      const maxRate     = degToRad(cfg.turnSpeed);
      const desiredRate = (keys.right ? maxRate : 0) - (keys.left ? maxRate : 0);
      this.applyTurnRate(desiredRate, dt);
    }

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

  updatePhysics(): void {
    PhysicsSystem.updateFlight(this);
  }
}
