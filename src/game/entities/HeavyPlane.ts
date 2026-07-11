import Phaser from 'phaser';
import { HeavyBehaviorConfig } from '../../types/game.types';
import { AIContext, EnemyPlane } from './EnemyPlane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { degToRad } from '../utils/helpers';

type HeavyState = 'RECOVER' | 'PASS' | 'RETURN';

export class HeavyPlane extends EnemyPlane {
  private behavior: HeavyBehaviorConfig;

  private aiState: HeavyState = 'PASS';

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    behavior: HeavyBehaviorConfig,
  ) {
    super(scene, x, y, behavior);
    this.behavior = behavior;
  }

  updateAI(delta: number, ctx: AIContext): void {
    if (this.haltIfDead()) return;

    const dt = delta / 1000;

    if (this.isBelowMinAltitude(ctx, this.behavior.ai.groundAvoidance.minAltitudeMargin)) {
      this.aiState = 'RECOVER';
    } else if (!ctx.enemyVisible) {
      this.aiState = 'RETURN';
    } else if (this.aiState === 'RECOVER') {
      if (this.isAtSafeAltitude(ctx, this.behavior.ai.groundAvoidance.safeAltitudeMargin)) {
        this.aiState = 'PASS';
      }
    } else {
      this.aiState = 'PASS';
    }

    this.steerToHeading(this.computeHeading(ctx), dt);
    PhysicsSystem.updateFlight(this);

    if (this.aiState === 'PASS') {
      this.updateFiring(delta, ctx, this.behavior.ai.targeting);
    }
  }

  private computeHeading(ctx: AIContext): number {
    switch (this.aiState) {

      case 'RECOVER': {
        return this.recoverHeading();
      }

      case 'RETURN': {
        return this.headingTo(ctx.target.x, ctx.target.y);
      }

      case 'PASS':
      default: {
        return this.computePassHeading(ctx);
      }
    }
  }

  private computePassHeading(ctx: AIContext): number {
    const dirSign  = Math.sign(Math.cos(this.rotation)) || 1;
    const aim      = this.predictIntercept(ctx.target, this.behavior.ai.targeting.leadFactor);
    const toTarget = this.headingTo(aim.x, aim.y);

    const targetAhead = (Math.sign(Math.cos(toTarget)) || dirSign) === dirSign;
    const level       = dirSign >= 0 ? 0 : Math.PI;

    if (!targetAhead) {
      return level;
    }

    const maxClimb = degToRad(this.behavior.ai.pass.maxClimbAngleDeg);
    const pitch    = Phaser.Math.Angle.Wrap(toTarget - level);

    return Phaser.Math.Angle.Wrap(
      level + Phaser.Math.Clamp(pitch, -maxClimb, maxClimb),
    );
  }
}
