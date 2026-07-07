const STORAGE_KEY = 'mr_music_enabled';

let memoryFallback = true;

export function isMusicEnabled(): boolean {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw === null ? memoryFallback : raw === 'true';
  } catch {
    return memoryFallback;
  }
}

export function setMusicEnabled(enabled: boolean): void {
  memoryFallback = enabled;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    void 0;
  }
}
