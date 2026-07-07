import airAssault from './air-assault.json';
import { MusicConfig } from '../../../../types/game.types';

export const MUSIC_TRACKS: MusicConfig[] = [
  airAssault as unknown as MusicConfig,
];

export function getMusicById(id: string): MusicConfig | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}
