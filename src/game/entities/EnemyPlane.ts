import Phaser from 'phaser';
import { EnemyBehaviorConfig, EnemyTargetingConfig, PlaneConfig } from '../../types/game.types';
import { Plane } from './Plane';
import { gameConfig } from '../config/gameConfig';
import { degToRad } from '../utils/helpers';

export interface AITarget {
  x: number;
  y: number;
  rotation: number;
  body: Phaser.Physics.Arcade.Body;
}

export interface AIContext {
  target: AITarget;
  threats: Phaser.Physics.Arcade.Group;
  targetVisible: boolean;
  enemyVisible: boolean;
  groundY: number;
}

export function behaviorToPlaneConfig(b: EnemyBehaviorConfig): PlaneConfig {
  return {
    sprite:    b.stats.sprite,
    width:     b.stats.width,
    health:    b.stats.health,
    damage:    b.stats.damage,
    fireRate:  b.stats.fireRate,
    maxSpeed:  b.flight.maxSpeed,
    turnSpeed: b.flight.turnSpeed,
    mass:      b.flight.mass,
  };
}

const RECOVER_CLIMB_ANGLE_DEG = 70;

export abstract class EnemyPlane extends Plane {
  protected fireCooldown: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    behavior: EnemyBehaviorConfig,
  ) {
    super(scene, x, y, behavior.stats.sprite, behaviorToPlaneConfig(behavior));
    this.setRotation(Math.PI);
  }

  abstract updateAI(delta: number, ctx: AIContext): void;

  onDamaged(_ctx: AIContext): void {}

  protected haltIfDead(): boolean {
    if (this.isAlive()) return false;
    (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    return true;
  }

  protected isBelowMinAltitude(ctx: AIContext, minAltitudeMargin: number): boolean {
    return ctx.groundY - this.y < minAltitudeMargin;
  }

  protected isAtSafeAltitude(ctx: AIContext, safeAltitudeMargin: number): boolean {
    return ctx.groundY - this.y >= safeAltitudeMargin;
  }

  protected recoverHeading(): number {
    const horizSign = Math.sign(Math.cos(this.rotation)) || 1;
    return horizSign >= 0
      ? -degToRad(RECOVER_CLIMB_ANGLE_DEG)
      : -(Math.PI - degToRad(RECOVER_CLIMB_ANGLE_DEG));
  }

  protected headingTo(x: number, y: number): number {
    return Phaser.Math.Angle.Between(this.x, this.y, x, y);
  }

  protected updateFiring(
    delta: number,
    ctx: AIContext,
    targeting: EnemyTargetingConfig,
  ): void {
    this.fireCooldown -= delta;
    if (!ctx.targetVisible) return;

    const dist = Phaser.Math.Distance.Between(
      this.x, this.y, ctx.target.x, ctx.target.y,
    );
    if (dist > targeting.maxFireRange) return;

    const aim      = this.predictIntercept(ctx.target, targeting.leadFactor);
    const aimAngle = this.headingTo(aim.x, aim.y);
    const aimError = Math.abs(Phaser.Math.Angle.Wrap(aimAngle - this.rotation));
    if (aimError > degToRad(targeting.fireAngleThreshold)) return;

    if (this.fireCooldown <= 0) {
      this.fireCooldown = 1000 / this.planeConfig.fireRate;
      const angle   = this.rotation;
      const halfLen = this.displayWidth / 2;
      const bx = this.x + Math.cos(angle) * halfLen;
      const by = this.y + Math.sin(angle) * halfLen;
      this.emit('fire', bx, by, angle, this.planeConfig.damage);
      this.spawnGunTrace();
    }
  }

  protected predictIntercept(
    target: AITarget,
    leadFactor: number,
  ): { x: number; y: number } {
    const bulletSpeed = gameConfig.bullet.speed;
    const vx          = target.body.velocity.x;
    const vy          = target.body.velocity.y;

    let t = 0;
    for (let i = 0; i < 2; i++) {
      const d = Phaser.Math.Distance.Between(
        this.x, this.y,
        target.x + vx * t * leadFactor,
        target.y + vy * t * leadFactor,
      );
      t = bulletSpeed > 0 ? d / bulletSpeed : 0;
    }

    return { x: target.x + vx * t * leadFactor, y: target.y + vy * t * leadFactor };
  }
}
