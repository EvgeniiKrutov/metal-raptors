import Phaser from 'phaser';
import { EnemyBehaviorConfig, PlaneConfig } from '../../types/game.types';
import { Plane } from './Plane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
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
    sprite:       b.stats.sprite,
    width:        b.stats.width,
    health:       b.stats.health,
    damage:       b.stats.damage,
    fireRate:     b.stats.fireRate,
    maxSpeed:     b.flight.maxSpeed,
    minSpeed:     b.flight.minSpeed,
    acceleration: b.flight.acceleration,
    braking:      b.flight.braking,
    turnSpeed:    b.flight.turnSpeed,
    weight:       b.flight.weight,
  };
}

type AIState = 'RECOVER' | 'ATTACK' | 'FLY' | 'EVADE' | 'RETURN';
type EvadePhase = 'ROLL' | 'JITTER' | 'UNROLL';

export class EnemyPlane extends Plane {
  private behavior: EnemyBehaviorConfig;
  private fireCooldown: number = 0;

  private aiState: AIState = 'ATTACK';
  private stateTimer: number = 0;
  private evadeHeading: number = 0;
  private evadePhase: EvadePhase = 'ROLL';
  private evadeRollSign: number = 1;
  private evadeRollAccum: number = 0;
  private jitterTimer: number = 0;
  private jitterOffset: number = 0;
  private flyWeaveT: number = 0;
  private flyBaseX: number = 0;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    behavior: EnemyBehaviorConfig,
  ) {
    super(scene, x, y, behavior.stats.sprite, behaviorToPlaneConfig(behavior));
    this.behavior = behavior;
    this.setRotation(Math.PI);
    this.stateTimer = behavior.ai.attack.durationMs;
  }

  updateAI(delta: number, ctx: AIContext): void {
    if (!this.isAlive()) {
      (this.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
      return;
    }

    const dt = delta / 1000;

    this.stateTimer  = Math.max(0, this.stateTimer - delta);
    this.jitterTimer = Math.max(0, this.jitterTimer - delta);

    if (this.checkGroundAvoidance(ctx)) {
    } else if (!ctx.enemyVisible) {
      if (this.aiState !== 'RETURN') {
        this.aiState = 'RETURN';
      }
    } else {
      if (this.aiState === 'RETURN') {
        this.enterAttack();
      }
      this.tickState(delta, ctx);
    }

    const desiredHeading = this.computeHeading(ctx);
    this.steerToward(desiredHeading, dt);
    this.manageSpeed(dt);
    PhysicsSystem.updateFlight(this, delta, true);

    if (this.aiState !== 'FLY' && this.aiState !== 'RETURN') {
      this.updateFiring(delta, ctx);
    }
  }

  private checkGroundAvoidance(ctx: AIContext): boolean {
    const altitude = ctx.groundY - this.y;
    const min      = this.behavior.ai.groundAvoidance.minAltitudeMargin;
    if (altitude >= min) return false;

    if (this.aiState !== 'RECOVER') {
      this.aiState = 'RECOVER';
    }
    return true;
  }

  onDamaged(ctx: AIContext): void {
    if (this.aiState === 'ATTACK' || this.aiState === 'FLY') {
      this.enterEvade(ctx);
    }
  }

  private tickState(delta: number, ctx: AIContext): void {
    if (this.aiState === 'RECOVER') {
      const altitude = ctx.groundY - this.y;
      const safe     = this.behavior.ai.groundAvoidance.safeAltitudeMargin;
      if (altitude >= safe) {
        this.enterAttack();
      }
      return;
    }

    if (this.aiState === 'ATTACK' && this.stateTimer <= 0) {
      this.enterFly(ctx);
      return;
    }

    if (this.aiState === 'FLY' && this.stateTimer <= 0) {
      this.enterAttack();
      return;
    }

    if (this.aiState === 'EVADE') {
      if (this.evadePhase === 'JITTER' && this.stateTimer <= 0) {
        this.evadePhase     = 'UNROLL';
        this.evadeRollAccum = 0;
      }
    }

    if (this.aiState === 'FLY') {
      this.flyWeaveT += delta / 1000;
    }
  }

  private enterAttack(): void {
    this.aiState    = 'ATTACK';
    this.stateTimer = this.behavior.ai.attack.durationMs;
  }

  private enterFly(ctx: AIContext): void {
    this.aiState    = 'FLY';
    this.stateTimer = this.behavior.ai.fly.durationMs;
    this.flyWeaveT  = 0;
    this.flyBaseX   = ctx.target.x;
  }

  private enterEvade(ctx: AIContext): void {
    this.evadeHeading   = Phaser.Math.Angle.Between(ctx.target.x, ctx.target.y, this.x, this.y);
    this.evadePhase     = 'ROLL';
    this.evadeRollSign  = Math.random() < 0.5 ? 1 : -1;
    this.evadeRollAccum = 0;
    this.jitterTimer    = 0;
    this.jitterOffset   = 0;
    this.stateTimer     = this.behavior.ai.evasion.durationMs;
    this.aiState        = 'EVADE';
  }

  private computeHeading(ctx: AIContext): number {
    switch (this.aiState) {

      case 'RECOVER': {
        const horizSign    = Math.sign(Math.cos(this.rotation)) || 1;
        const climbHeading = horizSign >= 0 ? -degToRad(70) : -(Math.PI - degToRad(70));
        return climbHeading;
      }

      case 'EVADE': {
        if (this.evadePhase === 'ROLL' || this.evadePhase === 'UNROLL') {
          const sign    = this.evadePhase === 'ROLL' ? this.evadeRollSign : -this.evadeRollSign;
          const maxStep = degToRad(this.planeConfig.turnSpeed) * (1 / 60);
          this.evadeRollAccum += maxStep;
          if (this.evadeRollAccum >= Math.PI * 2) {
            if (this.evadePhase === 'ROLL') {
              this.evadePhase     = 'JITTER';
              this.evadeRollAccum = 0;
            } else {
              this.enterAttack();
              const aim = this.predictIntercept(ctx.target);
              return Phaser.Math.Angle.Between(this.x, this.y, aim.x, aim.y);
            }
          }
          return this.rotation + sign * 100;
        }
        if (this.jitterTimer <= 0) {
          const amp         = this.behavior.ai.evasion.jitterAmplitude;
          this.jitterOffset = (Math.random() * 2 - 1) * amp;
          this.jitterTimer  = 1000 / this.behavior.ai.evasion.jitterHz;
        }
        return Phaser.Math.Angle.Wrap(this.evadeHeading + this.jitterOffset);
      }

      case 'FLY': {
        const flyCfg    = this.behavior.ai.fly;
        const targetY   = ctx.groundY * flyCfg.targetYFactor;
        const weaveX    = this.flyBaseX + Math.sin(this.flyWeaveT * Math.PI * 2 * flyCfg.weaveHz) * flyCfg.weaveAmplitude;
        return Phaser.Math.Angle.Between(this.x, this.y, weaveX, targetY);
      }

      case 'RETURN': {
        return Phaser.Math.Angle.Between(this.x, this.y, ctx.target.x, ctx.target.y);
      }

      case 'ATTACK':
      default: {
        const aim = this.predictIntercept(ctx.target);
        return Phaser.Math.Angle.Between(this.x, this.y, aim.x, aim.y);
      }
    }
  }

  private steerToward(targetHeading: number, dt: number): void {
    const maxStep = degToRad(this.planeConfig.turnSpeed) * dt;
    const diff    = Phaser.Math.Angle.Wrap(targetHeading - this.rotation);
    const step    = Phaser.Math.Clamp(diff, -maxStep, maxStep);
    this.rotation = Phaser.Math.Angle.Wrap(this.rotation + step);
  }

  private manageSpeed(dt: number): void {
    const cfg = this.planeConfig;
    this.currentSpeed += cfg.acceleration * dt;
    this.currentSpeed = Phaser.Math.Clamp(this.currentSpeed, cfg.minSpeed, cfg.maxSpeed);
  }

  private updateFiring(delta: number, ctx: AIContext): void {
    this.fireCooldown -= delta;
    if (!ctx.targetVisible) return;

    const tgt  = this.behavior.ai.targeting;
    const dist = Phaser.Math.Distance.Between(
      this.x, this.y, ctx.target.x, ctx.target.y,
    );
    if (dist > tgt.maxFireRange) return;

    const aim      = this.predictIntercept(ctx.target);
    const aimAngle = Phaser.Math.Angle.Between(this.x, this.y, aim.x, aim.y);
    const aimError = Math.abs(Phaser.Math.Angle.Wrap(aimAngle - this.rotation));
    if (aimError > degToRad(tgt.fireAngleThreshold)) return;

    if (this.fireCooldown <= 0) {
      this.fireCooldown = 1000 / this.planeConfig.fireRate;
      const angle   = this.rotation;
      const halfLen = this.displayWidth / 2;
      const bx = this.x + Math.cos(angle) * halfLen;
      const by = this.y + Math.sin(angle) * halfLen;
      this.emit('fire', bx, by, angle);
      this.spawnGunTrace();
    }
  }

  private predictIntercept(target: AITarget): { x: number; y: number } {
    const bulletSpeed = gameConfig.bullet.speed;
    const lead        = this.behavior.ai.targeting.leadFactor;
    const vx          = target.body.velocity.x;
    const vy          = target.body.velocity.y;

    let t = 0;
    for (let i = 0; i < 2; i++) {
      const d = Phaser.Math.Distance.Between(
        this.x, this.y,
        target.x + vx * t * lead,
        target.y + vy * t * lead,
      );
      t = bulletSpeed > 0 ? d / bulletSpeed : 0;
    }

    return { x: target.x + vx * t * lead, y: target.y + vy * t * lead };
  }
}
