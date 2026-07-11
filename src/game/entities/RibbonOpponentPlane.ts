import Phaser from 'phaser';
import { PlaneConfig, RibbonOpponentConfig } from '../../types/game.types';
import { Plane } from './Plane';
import { PhysicsSystem } from '../systems/PhysicsSystem';
import { RibbonPoint } from './Ribbon';

export interface RibbonArenaBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface RibbonAIContext {
  playerX: number;
  playerY: number;
  playerRotation: number;
  ribbonPoints: RibbonPoint[];
  bounds: RibbonArenaBounds;
}

const DECISION_MIN_MS = 1200;
const DECISION_MAX_MS = 2600;
const HUNT_CHANCE = 0.7;
const EDGE_MARGIN = 320;
const MIN_RIBBON_TARGET_SEGMENTS = 6;
const BEHIND_PLAYER_DISTANCE = 280;

function opponentPlaneConfig(cfg: RibbonOpponentConfig): PlaneConfig {
  return {
    sprite:    'enemy',
    width:     64,
    maxSpeed:  cfg.maxSpeed,
    turnSpeed: cfg.turnSpeed,
    mass:      cfg.mass,
    health:    1,
    damage:    0,
    fireRate:  0,
  };
}

export class RibbonOpponentPlane extends Plane {
  private mode: 'HUNT' | 'ROAM' = 'HUNT';
  private decisionTimer = 0;
  private targetFraction = 0.7;
  private roamX = 0;
  private roamY = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, cfg: RibbonOpponentConfig) {
    super(scene, x, y, 'enemy', opponentPlaneConfig(cfg));
    this.setRotation(Math.PI);
  }

  updateAI(delta: number, ctx: RibbonAIContext): void {
    const dt = delta / 1000;

    this.decisionTimer -= delta;
    if (this.decisionTimer <= 0) this.decide(ctx);

    this.steerToHeading(this.computeHeading(ctx), dt);
    PhysicsSystem.updateFlight(this);
  }

  private decide(ctx: RibbonAIContext): void {
    this.decisionTimer = Phaser.Math.Between(DECISION_MIN_MS, DECISION_MAX_MS);

    if (Math.random() < HUNT_CHANCE) {
      this.mode = 'HUNT';
      this.targetFraction = Phaser.Math.FloatBetween(0.45, 0.95);
    } else {
      this.mode = 'ROAM';
      const b = ctx.bounds;
      this.roamX = Phaser.Math.Between(b.left + EDGE_MARGIN, b.right - EDGE_MARGIN);
      this.roamY = Phaser.Math.Between(b.top + EDGE_MARGIN, b.bottom - EDGE_MARGIN);
    }
  }

  private computeHeading(ctx: RibbonAIContext): number {
    const escape = this.boundsEscapeHeading(ctx.bounds);
    if (escape !== null) return escape;

    if (this.mode === 'ROAM') {
      return Phaser.Math.Angle.Between(this.x, this.y, this.roamX, this.roamY);
    }

    const points = ctx.ribbonPoints;
    if (points.length - 1 < MIN_RIBBON_TARGET_SEGMENTS) {
      const behindX = ctx.playerX - Math.cos(ctx.playerRotation) * BEHIND_PLAYER_DISTANCE;
      const behindY = ctx.playerY - Math.sin(ctx.playerRotation) * BEHIND_PLAYER_DISTANCE;
      return Phaser.Math.Angle.Between(this.x, this.y, behindX, behindY);
    }

    const lastIndex = points.length - 1;
    const idx = Phaser.Math.Clamp(Math.round(this.targetFraction * lastIndex), 1, lastIndex);
    const target = points[idx];
    return Phaser.Math.Angle.Between(this.x, this.y, target.x, target.y);
  }

  private boundsEscapeHeading(bounds: RibbonArenaBounds): number | null {
    const nearLeft   = this.x < bounds.left + EDGE_MARGIN;
    const nearRight  = this.x > bounds.right - EDGE_MARGIN;
    const nearTop    = this.y < bounds.top + EDGE_MARGIN;
    const nearBottom = this.y > bounds.bottom - EDGE_MARGIN;

    if (!nearLeft && !nearRight && !nearTop && !nearBottom) return null;

    const centreX = (bounds.left + bounds.right) / 2;
    const centreY = (bounds.top + bounds.bottom) / 2;
    return Phaser.Math.Angle.Between(this.x, this.y, centreX, centreY);
  }
}
