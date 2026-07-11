import ribbon1 from './ribbon-1.json';
import { RibbonLevelConfig } from '../../../../../types/game.types';

export const RIBBON_LEVELS: RibbonLevelConfig[] = [
  ribbon1 as RibbonLevelConfig,
];

export function getRibbonLevels(): RibbonLevelConfig[] {
  return RIBBON_LEVELS;
}

export function getRibbonLevelById(id: string): RibbonLevelConfig | undefined {
  return RIBBON_LEVELS.find((l) => l.id === id);
}
