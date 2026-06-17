import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';

const REFERENCE_HEIGHT = 1080;

export class ParallaxSystem {
  private scene: Phaser.Scene;
  private bg!: Phaser.GameObjects.Image;
  private fg!: Phaser.GameObjects.Image;

  private readonly playerMinY: number = 20;
  private readonly playerMaxY: number;

  private readonly fgThreshold: number = 0.5;
  private readonly fgOffset: number = -30;

  private readonly bgOverscanY: number = 160;
  private readonly bgShiftRange: number = 140;
  private readonly overscanX: number = 160;

  private bgNeutralY: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.playerMaxY = gameConfig.world.height - 80;
  }

  create(bgKey: string, fgKey: string): void {
    this.bg = this.scene.add.image(0, 0, bgKey)
      .setDepth(-100)
      .setOrigin(0);

    this.fg = this.scene.add.image(0, 0, fgKey)
      .setDepth(-90)
      .setOrigin(0)
      .setAlpha(1);

    this.resize();

    this.scene.scale.on('resize', this.resize, this);
    this.scene.events.once('shutdown', () => {
      this.scene.scale.off('resize', this.resize, this);
    });
  }

  private resize(): void {
    const { width, height } = this.scene.scale;
    const viewWidth = (width / height) * REFERENCE_HEIGHT;
    const layerWidth = viewWidth + this.overscanX * 2;

    const bgHeight = REFERENCE_HEIGHT + this.bgOverscanY * 2;
    this.bgNeutralY = -this.bgOverscanY;

    this.bg.setDisplaySize(layerWidth, bgHeight);
    this.fg.setDisplaySize(layerWidth, REFERENCE_HEIGHT);
  }

  update(camera: Phaser.Cameras.Scene2D.Camera, playerY: number): void {
    const view = camera.worldView;

    const t = Phaser.Math.Clamp(
      (playerY - this.playerMinY) / (this.playerMaxY - this.playerMinY),
      0, 1
    );

    const alpha = Phaser.Math.Clamp(
      (t + this.fgThreshold) / (1 + this.fgThreshold),
      0, 1
    );

    const layerX = view.x - this.overscanX;

    this.bg.x = layerX;
    this.bg.y = view.y + this.bgNeutralY
      + Phaser.Math.Linear(this.bgShiftRange, -this.bgShiftRange, t);

    this.fg.x = layerX;
    this.fg.y = view.y + Phaser.Math.Linear(REFERENCE_HEIGHT, this.fgOffset, alpha);
  }
}
