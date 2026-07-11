import Phaser from 'phaser';
import { KamikazeBehaviorConfig } from '../../types/game.types';
import { AIContext, EnemyPlane } from './EnemyPlane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { degToRad } from '../utils/helpers';

type KamikazeState = 'RECOVER' | 'PURSUE' | 'BREAK_OFF' | 'RETURN';

export class KamikazePlane extends EnemyPlane {
  private behavior: KamikazeBehaviorConfig;

  private aiState: KamikazeState = 'PURSUE';
  private stateTimer: number = 0;
  private weaveT: number = 0;
  private breakOffHeading: number = 0;
  private detonated: boolean = false;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    behavior: KamikazeBehaviorConfig,
  ) {
    super(scene, x, y, behavior);
    this.behavior = behavior;
    this.stateTimer = behavior.ai.pursue.durationMs;
  }

  getBlastDamageRadius(): number {
    return this.behavior.ai.blast.damageRadius * this.scaleX;
  }

  updateAI(delta: number, ctx: AIContext): void {
    if (this.haltIfDead()) return;

    if (this.tryDetonate(ctx)) return;

    const dt = delta / 1000;
    this.stateTimer = Math.max(0, this.stateTimer - delta);

    if (this.isBelowMinAltitude(ctx, this.behavior.ai.groundAvoidance.minAltitudeMargin)) {
      this.aiState = 'RECOVER';
    } else if (!ctx.enemyVisible) {
      this.aiState = 'RETURN';
    } else {
      this.tickState(delta, ctx);
    }

    this.steerToHeading(this.computeHeading(ctx), dt);
    PhysicsSystem.updateFlight(this);
  }

  private tryDetonate(ctx: AIContext): boolean {
    if (this.detonated) return true;

    const triggerRadius = this.behavior.ai.blast.triggerRadius * this.scaleX;
    const dist = Phaser.Math.Distance.Between(
      this.x, this.y, ctx.target.x, ctx.target.y,
    );
    if (dist > triggerRadius) return false;

    this.detonated = true;
    this.emit('detonate', this);
    return true;
  }

  private tickState(delta: number, ctx: AIContext): void {
    if (this.aiState === 'RECOVER') {
      if (this.isAtSafeAltitude(ctx, this.behavior.ai.groundAvoidance.safeAltitudeMargin)) {
        this.enterPursue();
      }
      return;
    }

    if (this.aiState === 'RETURN') {
      this.enterPursue();
      return;
    }

    if (this.aiState === 'PURSUE') {
      this.weaveT += delta / 1000;
      if (this.stateTimer <= 0) {
        this.enterBreakOff(ctx);
      }
      return;
    }

    if (this.aiState === 'BREAK_OFF' && this.stateTimer <= 0) {
      this.enterPursue();
    }
  }

  private enterPursue(): void {
    this.aiState    = 'PURSUE';
    this.stateTimer = this.behavior.ai.pursue.durationMs;
    this.weaveT     = 0;
  }

  private enterBreakOff(ctx: AIContext): void {
    const away   = Phaser.Math.Angle.Between(ctx.target.x, ctx.target.y, this.x, this.y);
    const jitter = degToRad(this.behavior.ai.breakOff.headingJitterDeg);

    this.breakOffHeading = Phaser.Math.Angle.Wrap(
      away + Phaser.Math.FloatBetween(-jitter, jitter),
    );
    this.aiState    = 'BREAK_OFF';
    this.stateTimer = this.behavior.ai.breakOff.durationMs;
  }

  private computeHeading(ctx: AIContext): number {
    switch (this.aiState) {

      case 'RECOVER': {
        return this.recoverHeading();
      }

      case 'BREAK_OFF': {
        return this.breakOffHeading;
      }

      case 'RETURN': {
        return this.headingTo(ctx.target.x, ctx.target.y);
      }

      case 'PURSUE':
      default: {
        const cfg   = this.behavior.ai.pursue;
        const weave = Math.sin(this.weaveT * Math.PI * 2 * cfg.weaveHz)
          * degToRad(cfg.weaveAmplitudeDeg);
        return Phaser.Math.Angle.Wrap(
          this.headingTo(ctx.target.x, ctx.target.y) + weave,
        );
      }
    }
  }
}
