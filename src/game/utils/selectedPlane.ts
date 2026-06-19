import { PlaneOption, getDefaultPlane, getPlaneById } from '../config/data/planes/index';

const STORAGE_KEY = 'mr_selected_plane';

let memoryFallback: string | null = null;

function readStore(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return memoryFallback;
  }
}

function writeStore(id: string): void {
  memoryFallback = id;
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    void 0;
  }
}

export function getSelectedPlaneId(): string {
  const stored = readStore();
  if (stored && getPlaneById(stored)) return stored;
  return getDefaultPlane().id;
}

export function getSelectedPlane(): PlaneOption {
  return getPlaneById(getSelectedPlaneId()) ?? getDefaultPlane();
}

export function setSelectedPlaneId(id: string): void {
  if (!getPlaneById(id)) return;
  writeStore(id);
}
