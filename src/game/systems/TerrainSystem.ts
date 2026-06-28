import Phaser from 'phaser';
import { GroundCurveConfig } from '../../types/game.types';

export class TerrainSystem {
  private scene: Phaser.Scene;
  private background!: Phaser.GameObjects.Image;

  private worldWidth: number;
  private worldHeight: number;

  private ground!: GroundCurveConfig;

  constructor(
    scene: Phaser.Scene,
    worldWidth: number,
    worldHeight: number,
  ) {
    this.scene = scene;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  create(mapKey: string, ground: GroundCurveConfig): void {
    this.background = this.scene.add
      .image(0, 0, mapKey)
      .setOrigin(0, 0)
      .setDepth(-100);

    this.background.setDisplaySize(this.worldWidth, this.worldHeight);

    this.ground = ground;
  }

  groundYAt(x: number): number {
    if (!this.ground) return this.worldHeight;

    const { baseline, period, harmonics } = this.ground;
    const t = (2 * Math.PI * x) / period;

    let y = baseline;
    for (let n = 0; n < harmonics.length; n++) {
      const harmonic = harmonics[n];
      const angle = (n + 1) * t;
      y += harmonic.cos * Math.cos(angle) + harmonic.sin * Math.sin(angle);
    }

    return y;
  }

  update(_camera: Phaser.Cameras.Scene2D.Camera): void {
  }
}
