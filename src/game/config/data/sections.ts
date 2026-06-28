import { SectionConfig } from '../../../types/game.types';
import { getLevels } from './levels/index';
import { getBattlefieldLevels } from './battlefield/levels/index';

export const SECTIONS: SectionConfig[] = [
  {
    id: 'air',
    name: 'Air Fights',
    sceneKey: 'GameScene',
    levels: getLevels().map((l) => ({ id: l.id, name: l.name })),
  },
  {
    id: 'battlefield',
    name: 'Battlefield',
    sceneKey: 'BattlefieldScene',
    levels: getBattlefieldLevels().map((l) => ({ id: l.id, name: l.name })),
  },
];

export function getSections(): SectionConfig[] {
  return SECTIONS;
}

export function getSceneKeyForLevel(levelId: string): string {
  for (const section of SECTIONS) {
    if (section.levels.some((l) => l.id === levelId)) {
      return section.sceneKey;
    }
  }
  return 'GameScene';
}
