const STUB_PLAYER_ID_KEY = 'mr_stub_player_id';

const API_BASE_URL = `${import.meta.env.VITE_API_DOMAIN}:${import.meta.env.VITE_API_PORT}`;

export interface PlayerProfile {
  username: string;
}

function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getStubPlayerId(): string {
  const existing = localStorage.getItem(STUB_PLAYER_ID_KEY);
  if (existing) return existing;

  const id = generateUuid();
  localStorage.setItem(STUB_PLAYER_ID_KEY, id);
  return id;
}

export async function fetchPlayerProfile(playerId: string): Promise<PlayerProfile> {
  const response = await fetch(`${API_BASE_URL}/player`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerId }),
  });

  if (!response.ok) {
    throw new Error(`Player request failed with status ${response.status}`);
  }

  return response.json();
}
