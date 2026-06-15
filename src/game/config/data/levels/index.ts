import level1 from './level-1.json';
import level2 from './level-2.json';
import { LevelConfig } from '../../../../types/game.types';

export const LEVELS: LevelConfig[] = [
  level1 as LevelConfig,
  level2 as LevelConfig,
];

export function getLevels(): LevelConfig[] {
  return LEVELS;
}

export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
