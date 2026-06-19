export type EraId = 'world_war_1' | 'world_war_2' | 'cold_war' | 'modern_era';

export interface EraOption {
  id: EraId;
  name: string;
}

export interface PlaneOption {
  id: string;
  name: string;
  file: string;
  era: EraId;
}

const PLANES_ROOT = 'sprites/planes';

export const ERAS: EraOption[] = [
  { id: 'world_war_1', name: 'World War 1' },
  { id: 'world_war_2', name: 'World War 2' },
  { id: 'cold_war', name: 'Cold War' },
  { id: 'modern_era', name: 'Modern Era' },
];

const SPRITE_FILES: Record<EraId, string[]> = {
  world_war_1: [
    'Sopwith_Camel.png',
    'Albatros_D.III.png',
    'Breguet_14.png',
    'Fokker_Dr_1.png',
    'Fokker_Dr_VII.png',
    'Fokker_Eindecker.png',
    'Gotha_G.IV.png',
    'Neuport_17.png',
    'Royal_Aircraft_Factory_SE5.png',
    'SPAD_S.XIII.png',
    'de_Havilland_DH4.png',
  ],
  world_war_2: ['IL_2.png'],
  cold_war: [],
  modern_era: [],
};

const DEFAULT_PLANE_ID = 'Sopwith_Camel';

function stripExtension(fileName: string): string {
  return fileName.replace(/\.png$/i, '');
}

function nameFromSprite(fileName: string): string {
  return stripExtension(fileName).replace(/_/g, ' ');
}

export const PLANES: PlaneOption[] = ERAS.flatMap((era) =>
  SPRITE_FILES[era.id].map((fileName) => ({
    id: stripExtension(fileName),
    name: nameFromSprite(fileName),
    file: `${PLANES_ROOT}/${era.id}/${fileName}`,
    era: era.id,
  })),
);

export function getPlanes(): PlaneOption[] {
  return PLANES;
}

export function getEras(): EraOption[] {
  return ERAS;
}

export function getPlanesByEra(era: EraId): PlaneOption[] {
  return PLANES.filter((plane) => plane.era === era);
}

export function getPlaneById(id: string): PlaneOption | undefined {
  return PLANES.find((plane) => plane.id === id);
}

export function getDefaultPlane(): PlaneOption {
  return getPlaneById(DEFAULT_PLANE_ID) ?? PLANES[0];
}

export function planeTextureKey(id: string): string {
  return `plane_${id}`;
}
