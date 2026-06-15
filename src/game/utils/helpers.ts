import Phaser from 'phaser';

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function wrapX(x: number, width: number): number {
  if (x < 0)      return width;
  if (x > width)  return 0;
  return x;
}

export function degToRad(deg: number): number {
  return Phaser.Math.DegToRad(deg);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function mapRange(
  value: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number
): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

export function healthColour(percent: number): number {
  if (percent > 0.6) return 0x00e040;
  if (percent > 0.3) return 0xffd700;
  return 0xff2020;
}

export function backgroundLayerPaths(set: string, variant: string) {
  const base = `backgrounds/${set}/${set}`;
  return {
    bg:     `${base}_background_${variant}.png`,
    fg:     `${base}_foreground_${variant}.png`,
    ground: `${base}_ground_${variant}.png`,
  };
}

export function backgroundLayerKeys(set: string, variant: string) {
  return {
    bg:     `bg_${set}_${variant}`,
    fg:     `fg_${set}_${variant}`,
    ground: `ground_${set}_${variant}`,
  };
}

/**
 * True on touch-capable devices (phones/tablets). Used to decide whether to
 * show the on-screen joystick + fire button instead of keyboard controls.
 */
export function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0
  );
}
