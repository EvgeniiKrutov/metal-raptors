import Phaser from 'phaser';
import { EnemyBehaviorConfig } from '../../types/game.types';
import { EnemyPlane } from './EnemyPlane';
import { FighterPlane } from './FighterPlane';
import { KamikazePlane } from './KamikazePlane';
import { HeavyPlane } from './HeavyPlane';

export function createEnemyPlane(
  scene: Phaser.Scene,
  x: number,
  y: number,
  behavior: EnemyBehaviorConfig,
): EnemyPlane {
  switch (behavior.role) {
    case 'kamikaze':
      return new KamikazePlane(scene, x, y, behavior);
    case 'heavy':
      return new HeavyPlane(scene, x, y, behavior);
    case 'fighter':
    default:
      return new FighterPlane(scene, x, y, behavior);
  }
}
