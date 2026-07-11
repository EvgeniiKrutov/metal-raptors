import Phaser from 'phaser';
import { FighterBehaviorConfig } from '../../types/game.types';
import { AIContext, EnemyPlane } from './EnemyPlane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { degToRad } from '../utils/helpers';

type FighterState = 'RECOVER' | 'ATTACK' | 'FLY' | 'EVADE' | 'RETURN';
type EvadePhase = 'ROLL' | 'JITTER' | 'UNROLL';

export class FighterPlane extends EnemyPlane {
  private behavior: FighterBehaviorConfig;

  private aiState: FighterState = 'ATTACK';
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
    behavior: FighterBehaviorConfig,
  ) {
    super(scene, x, y, behavior);
    this.behavior = behavior;
    this.stateTimer = behavior.ai.attack.durationMs;
  }

  updateAI(delta: number, ctx: AIContext): void {
    if (this.haltIfDead()) return;

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
    this.steerToHeading(desiredHeading, dt);
    PhysicsSystem.updateFlight(this);

    if (this.aiState !== 'FLY' && this.aiState !== 'RETURN') {
      this.updateFiring(delta, ctx, this.behavior.ai.targeting);
    }
  }

  private checkGroundAvoidance(ctx: AIContext): boolean {
    if (!this.isBelowMinAltitude(ctx, this.behavior.ai.groundAvoidance.minAltitudeMargin)) {
      return false;
    }

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
      if (this.isAtSafeAltitude(ctx, this.behavior.ai.groundAvoidance.safeAltitudeMargin)) {
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
        return this.recoverHeading();
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
              const aim = this.predictIntercept(ctx.target, this.behavior.ai.targeting.leadFactor);
              return this.headingTo(aim.x, aim.y);
            }
          }
          return this.rotation + sign * Math.PI * 0.9;
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
        return this.headingTo(weaveX, targetY);
      }

      case 'RETURN': {
        return this.headingTo(ctx.target.x, ctx.target.y);
      }

      case 'ATTACK':
      default: {
        const aim = this.predictIntercept(ctx.target, this.behavior.ai.targeting.leadFactor);
        return this.headingTo(aim.x, aim.y);
      }
    }
  }
}
