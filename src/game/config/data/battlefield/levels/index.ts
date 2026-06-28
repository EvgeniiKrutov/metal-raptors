import battlefield1 from './battlefield-1.json';
import { BattlefieldLevelConfig } from '../../../../../types/game.types';

export const BATTLEFIELD_LEVELS: BattlefieldLevelConfig[] = [
  battlefield1 as BattlefieldLevelConfig,
];

export function getBattlefieldLevels(): BattlefieldLevelConfig[] {
  return BATTLEFIELD_LEVELS;
}

export function getBattlefieldLevelById(id: string): BattlefieldLevelConfig | undefined {
  return BATTLEFIELD_LEVELS.find((l) => l.id === id);
}
