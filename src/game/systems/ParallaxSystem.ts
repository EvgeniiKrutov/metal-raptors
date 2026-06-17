import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';

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

  private bgNeutralY: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.playerMaxY = gameConfig.world.height - 80;
  }

  create(bgKey: string, fgKey: string): void {
    const { display } = gameConfig;

    const bgHeight = display.height + this.bgOverscanY * 2;
    const bgScale  = bgHeight / display.height;
    const bgWidth  = display.width * bgScale;

    this.bgNeutralY = (display.height - bgHeight) / 2;

    this.bg = this.scene.add.image(0, 0, bgKey)
      .setDepth(-100)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(bgWidth, bgHeight);
    this.bg.x = (display.width - bgWidth) / 2;
    this.bg.y = this.bgNeutralY;

    this.fg = this.scene.add.image(0, display.height, fgKey)
      .setDepth(-90)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDisplaySize(display.width, display.height)
      .setAlpha(1);
  }

  update(_camera: Phaser.Cameras.Scene2D.Camera, playerY: number): void {
    const { display } = gameConfig;

    const t = Phaser.Math.Clamp(
      (playerY - this.playerMinY) / (this.playerMaxY - this.playerMinY),
      0, 1
    );

    const alpha = Phaser.Math.Clamp(
      (t + this.fgThreshold) / (1 + this.fgThreshold),
      0, 1
    );

    this.fg.y = Phaser.Math.Linear(display.height, this.fgOffset, alpha);

    this.bg.y = this.bgNeutralY + Phaser.Math.Linear(this.bgShiftRange, -this.bgShiftRange, t);
  }
}
