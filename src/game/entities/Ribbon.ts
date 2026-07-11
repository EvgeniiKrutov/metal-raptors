import Phaser from 'phaser';
import { RibbonConfig } from '../../types/game.types';

export interface RibbonPoint {
  x: number;
  y: number;
}

const RECT_TEXTURE_KEY = 'ribbon_rect';
const RECT_TEXTURE_SIZE = 16;
const CHUNK_FALL_DISTANCE = 160;
const CHUNK_FADE_MS = 700;
const CHUNK_SPIN_DEG = 40;
const RIBBON_DEPTH = 5;

export class Ribbon {
  private scene: Phaser.Scene;
  private config: RibbonConfig;
  private textureKey: string;
  private tint: number | null;

  private points: RibbonPoint[];
  private images: Phaser.GameObjects.Image[] = [];
  private growAccum = 0;

  static ensureRectTexture(scene: Phaser.Scene): void {
    if (scene.textures.exists(RECT_TEXTURE_KEY)) return;

    const gfx = scene.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(0xffffff, 1);
    gfx.fillRect(0, 0, RECT_TEXTURE_SIZE, RECT_TEXTURE_SIZE);
    gfx.generateTexture(RECT_TEXTURE_KEY, RECT_TEXTURE_SIZE, RECT_TEXTURE_SIZE);
    gfx.destroy();
  }

  constructor(
    scene: Phaser.Scene,
    config: RibbonConfig,
    anchor: RibbonPoint,
    spriteKey?: string,
  ) {
    this.scene = scene;
    this.config = config;

    if (spriteKey && scene.textures.exists(spriteKey)) {
      this.textureKey = spriteKey;
      this.tint = null;
    } else {
      Ribbon.ensureRectTexture(scene);
      this.textureKey = RECT_TEXTURE_KEY;
      this.tint = Phaser.Display.Color.HexStringToColor(config.color).color;
    }

    this.points = [{ x: anchor.x, y: anchor.y }];
  }

  update(anchor: RibbonPoint): void {
    const head = this.points[0];
    this.growAccum += Phaser.Math.Distance.Between(head.x, head.y, anchor.x, anchor.y);
    head.x = anchor.x;
    head.y = anchor.y;

    const maxPoints = this.config.maxSegments + 1;
    while (this.growAccum >= this.config.segmentLength && this.points.length < maxPoints) {
      const tail = this.points[this.points.length - 1];
      this.points.push({ x: tail.x, y: tail.y });
      this.growAccum -= this.config.segmentLength;
    }
    if (this.points.length >= maxPoints) {
      this.growAccum = 0;
    }

    for (let i = 1; i < this.points.length; i++) {
      const prev = this.points[i - 1];
      const point = this.points[i];
      const dx = point.x - prev.x;
      const dy = point.y - prev.y;
      const dist = Math.hypot(dx, dy);
      if (dist > this.config.segmentLength) {
        const t = this.config.segmentLength / dist;
        point.x = prev.x + dx * t;
        point.y = prev.y + dy * t;
      }
    }

    this.syncImages();
  }

  getPoints(): RibbonPoint[] {
    return this.points;
  }

  getSegmentCount(): number {
    return this.points.length - 1;
  }

  cut(segmentIndex: number): number {
    const total = this.getSegmentCount();
    if (segmentIndex < 0 || segmentIndex >= total) return 0;

    const chunkSegments = total - segmentIndex;
    const chunkImages = this.images.splice(segmentIndex);
    this.points.splice(segmentIndex + 1);
    this.growAccum = 0;

    for (const img of chunkImages) {
      this.scene.tweens.add({
        targets: img,
        alpha: 0,
        y: img.y + CHUNK_FALL_DISTANCE,
        angle: img.angle + Phaser.Math.Between(-CHUNK_SPIN_DEG, CHUNK_SPIN_DEG),
        duration: CHUNK_FADE_MS,
        ease: 'Quad.easeIn',
        onComplete: () => img.destroy(),
      });
    }

    return chunkSegments;
  }

  destroy(): void {
    for (const img of this.images) {
      this.scene.tweens.killTweensOf(img);
      img.destroy();
    }
    this.images.length = 0;
    this.points.length = 0;
  }

  private syncImages(): void {
    const needed = this.points.length - 1;

    while (this.images.length < needed) {
      const img = this.scene.add.image(0, 0, this.textureKey)
        .setOrigin(0.5)
        .setDepth(RIBBON_DEPTH);
      if (this.tint !== null) img.setTint(this.tint);
      this.images.push(img);
    }
    while (this.images.length > needed) {
      const img = this.images.pop();
      img?.destroy();
    }

    for (let i = 0; i < needed; i++) {
      const a = this.points[i];
      const b = this.points[i + 1];
      const dist = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
      const img = this.images[i];
      img.setPosition((a.x + b.x) / 2, (a.y + b.y) / 2);
      img.setRotation(Math.atan2(b.y - a.y, b.x - a.x));
      img.setDisplaySize(Math.max(dist, 1), this.config.width);
    }
  }
}
