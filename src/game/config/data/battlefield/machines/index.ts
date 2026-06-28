import truck from './truck.json';
import { MachineConfig } from '../../../../../types/game.types';

export const MACHINES: Record<string, MachineConfig> = {
  truck: truck as MachineConfig,
};

export function getMachine(id: string): MachineConfig | undefined {
  return MACHINES[id];
}

export function isMachineType(id: string): boolean {
  return id in MACHINES;
}
