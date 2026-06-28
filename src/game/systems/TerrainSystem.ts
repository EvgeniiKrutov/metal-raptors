import Phaser from 'phaser';
import { GroundCurveConfig, GroundPoint } from '../../types/game.types';

export class TerrainSystem {
  private scene: Phaser.Scene;
  private background!: Phaser.GameObjects.Image;

  private tileWidth: number;
  private worldWidth: number;
  private worldHeight: number;

  private points: GroundPoint[] = [];

  constructor(
    scene: Phaser.Scene,
    tileWidth: number,
    worldWidth: number,
    worldHeight: number,
  ) {
    this.scene = scene;
    this.tileWidth = tileWidth;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
  }

  create(mapKey: string, ground: GroundCurveConfig): void {
    this.background = this.scene.add
      .image(0, 0, mapKey)
      .setOrigin(0, 0)
      .setDepth(-100);

    this.background.setDisplaySize(this.worldWidth, this.worldHeight);

    this.points = [...ground.points].sort((a, b) => a.x - b.x);
  }

  groundYAt(x: number): number {
    if (this.points.length === 0) return this.worldHeight;

    const xt = ((x % this.tileWidth) + this.tileWidth) % this.tileWidth;

    if (xt <= this.points[0].x) return this.points[0].y;
    const last = this.points[this.points.length - 1];
    if (xt >= last.x) return last.y;

    for (let i = 0; i < this.points.length - 1; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      if (xt >= a.x && xt <= b.x) {
        const span = b.x - a.x;
        const t = span === 0 ? 0 : (xt - a.x) / span;
        return Phaser.Math.Linear(a.y, b.y, t);
      }
    }

    return last.y;
  }

  update(_camera: Phaser.Cameras.Scene2D.Camera): void {
  }
}
