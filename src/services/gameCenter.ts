import { registerPlugin, Capacitor } from '@capacitor/core';

export interface GameCenterResult {
  isAuthenticated: boolean;
  userId: string | null;
}

interface GameCenterPlugin {
  authenticate(): Promise<GameCenterResult>;
}

const GameCenter = registerPlugin<GameCenterPlugin>('GameCenter');

const NO_ACCESS: GameCenterResult = { isAuthenticated: false, userId: null };

const MOCK_USER: GameCenterResult = {
  isAuthenticated: true,
  userId: 'MOCK_TEAM_PLAYER_ID',
};

const isIosNative =
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

const AUTH_TIMEOUT_MS = 10_000;

export async function authenticateGameCenter(): Promise<GameCenterResult> {
  if (!isIosNative) {
    return import.meta.env.VITE_GAMECENTER_MOCK === 'true' ? MOCK_USER : NO_ACCESS;
  }

  const withTimeout = new Promise<GameCenterResult>((resolve) => {
    setTimeout(() => resolve(NO_ACCESS), AUTH_TIMEOUT_MS);
  });

  try {
    return await Promise.race([GameCenter.authenticate(), withTimeout]);
  } catch {
    return NO_ACCESS;
  }
}
