import fighter from './fighter.json';
import kamikaze from './kamikaze.json';
import heavy from './heavy.json';
import { EnemyBehaviorConfig } from '../../../../types/game.types';

export const ENEMY_BEHAVIORS: Record<string, EnemyBehaviorConfig> = {
  fighter: fighter as EnemyBehaviorConfig,
  kamikaze: kamikaze as EnemyBehaviorConfig,
  heavy: heavy as EnemyBehaviorConfig,
};

export function getEnemyBehavior(id: string): EnemyBehaviorConfig {
  const behavior = ENEMY_BEHAVIORS[id];
  if (!behavior) {
    throw new Error(`Unknown enemy behavior id: "${id}"`);
  }
  return behavior;
}
