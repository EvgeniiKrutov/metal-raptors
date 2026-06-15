const STORAGE_KEY = 'mr_completed_levels';

let memoryFallback: string[] = [];

function readStore(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...memoryFallback];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [...memoryFallback];
  }
}

function writeStore(ids: string[]): void {
  memoryFallback = [...ids];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    void 0;
  }
}

export function getCompleted(): string[] {
  return readStore();
}

export function isCompleted(id: string): boolean {
  return readStore().includes(id);
}

export function markCompleted(id: string): void {
  const ids = readStore();
  if (ids.includes(id)) return;
  ids.push(id);
  writeStore(ids);
}
