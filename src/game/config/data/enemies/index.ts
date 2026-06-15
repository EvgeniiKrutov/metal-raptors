import fighter from './fighter.json';
import { EnemyBehaviorConfig } from '../../../../types/game.types';

export const ENEMY_BEHAVIORS: Record<string, EnemyBehaviorConfig> = {
  fighter: fighter as EnemyBehaviorConfig,
};

export function getEnemyBehavior(id: string): EnemyBehaviorConfig {
  const behavior = ENEMY_BEHAVIORS[id];
  if (!behavior) {
    throw new Error(`Unknown enemy behavior id: "${id}"`);
  }
  return behavior;
}
