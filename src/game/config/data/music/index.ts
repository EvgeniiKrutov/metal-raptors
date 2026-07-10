import airAssault from './air-assault.json';
import barnstormerWaltz from './barnstormer-waltz.json';
import brassBattalion from './brass-battalion.json';
import dreadLegion from './dread-legion.json';
import ironRequiem from './iron-requiem.json';
import ironSkies from './iron-skies.json';
import obsidianMarch from './obsidian-march.json';
import steelTalons from './steel-talons.json';
import raptorMarch from './raptor-march.json';
import squadronSwing from './squadron-swing.json';
import flakParade from './flak-parade.json';
import thunderRun from './thunder-run.json';
import { MusicConfig } from '../../../../types/game.types';

export const MUSIC_TRACKS: MusicConfig[] = [
  airAssault as unknown as MusicConfig,
  barnstormerWaltz as unknown as MusicConfig,
  brassBattalion as unknown as MusicConfig,
  dreadLegion as unknown as MusicConfig,
  ironRequiem as unknown as MusicConfig,
  ironSkies as unknown as MusicConfig,
  obsidianMarch as unknown as MusicConfig,
  steelTalons as unknown as MusicConfig,
  raptorMarch as unknown as MusicConfig,
  squadronSwing as unknown as MusicConfig,
  flakParade as unknown as MusicConfig,
  thunderRun as unknown as MusicConfig,
];

export function getMusicById(id: string): MusicConfig | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}
