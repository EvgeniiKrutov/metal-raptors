import airAssault from './air-assault.json';
import barnstormerWaltz from './barnstormer-waltz.json';
import blackTide from './black-tide.json';
import brassBattalion from './brass-battalion.json';
import dreadLegion from './dread-legion.json';
import ironRequiem from './iron-requiem.json';
import ironSkies from './iron-skies.json';
import obsidianMarch from './obsidian-march.json';
import steelTalons from './steel-talons.json';
import raptorMarch from './raptor-march.json';
import squadronSwing from './squadron-swing.json';
import flakParade from './flak-parade.json';
import gallowsGallop from './gallows-gallop.json';
import neonStrafe from './neon-strafe.json';
import slipstream from './slipstream.json';
import thunderRun from './thunder-run.json';
import velvetDossier from './velvet-dossier.json';
import machBreak from './mach-break.json';
import klaxonCircuit from './klaxon-circuit.json';
import apexColossus from './apex-colossus.json';
import { MusicConfig } from '../../../../types/game.types';

export const MUSIC_TRACKS: MusicConfig[] = [
  airAssault as unknown as MusicConfig,
  barnstormerWaltz as unknown as MusicConfig,
  blackTide as unknown as MusicConfig,
  brassBattalion as unknown as MusicConfig,
  dreadLegion as unknown as MusicConfig,
  ironRequiem as unknown as MusicConfig,
  ironSkies as unknown as MusicConfig,
  obsidianMarch as unknown as MusicConfig,
  steelTalons as unknown as MusicConfig,
  raptorMarch as unknown as MusicConfig,
  squadronSwing as unknown as MusicConfig,
  flakParade as unknown as MusicConfig,
  gallowsGallop as unknown as MusicConfig,
  slipstream as unknown as MusicConfig,
  thunderRun as unknown as MusicConfig,
  neonStrafe as unknown as MusicConfig,
  velvetDossier as unknown as MusicConfig,
  machBreak as unknown as MusicConfig,
  klaxonCircuit as unknown as MusicConfig,
  apexColossus as unknown as MusicConfig,
];

export function getMusicById(id: string): MusicConfig | undefined {
  return MUSIC_TRACKS.find((t) => t.id === id);
}
