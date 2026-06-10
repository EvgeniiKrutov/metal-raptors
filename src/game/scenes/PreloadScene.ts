import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createLoadingUI();

    this.load.image('player_temp', 'sprites/planes/world_war_1/Sopwith_Camel.png');
    this.load.image('enemy_temp', 'sprites/planes/world_war_1/Fokker_Dr_1.png');
    this.load.image('bg', 'backgrounds/verden/verden_background_dawn.png');
    this.load.image('fg', 'backgrounds/verden/verden_foreground_dawn.png');
    this.load.image('ground', 'backgrounds/verden/verden_ground_dawn.png');
    this.load.image('smoke', 'effects/smoke.png');
    this.load.image('bullet', 'effects/bullet.png');
    this.load.spritesheet('explosion', 'effects/explosion.png', {
      frameWidth: 165,
      frameHeight: 196,
    });
    this.load.audio('bullet_shot', 'sounds/bullet_shot_1.wav');
  }

  create(): void {
    this.makePlayerTexture();
    this.makeEnemyTexture();
    this.makeExplosionAnimation();

    this.scene.start('GameScene');
  }

  private makeExplosionAnimation(): void {
    if (this.anims.exists('explosion')) return;

    this.anims.create({
      key: 'explosion',
      frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 21 }),
      frameRate: 30,
      repeat: 0,
    });
  }

  private makePlaneTexture(spriteName: string, planeName: string): void {
    const tempSprite = this.add.sprite(0, 0, spriteName);

    const baseWidth = 150;
    const baseHeight = (baseWidth * tempSprite.height) / tempSprite.width;

    const scaleX = baseWidth / tempSprite.width;
    const scaleY = baseHeight / tempSprite.height;

    tempSprite.setScale(scaleX, scaleY);
    tempSprite.setOrigin(0, 0);

    if (planeName === 'enemy') {
      tempSprite.setFlipY(true);
    }

    const rt = this.add.renderTexture(0, 0, baseWidth, baseHeight);
    rt.draw(tempSprite, 0, 0);
    rt.saveTexture(planeName);

    tempSprite.destroy();
    rt.destroy();
  }

  private makePlayerTexture(): void {
    this.makePlaneTexture('player_temp', 'player');
  }

  private makeEnemyTexture(): void {
    this.makePlaneTexture('enemy_temp', 'enemy');
  }

  private createLoadingUI(): void {
    const { width, height } = gameConfig.display;
    const cx = width / 2;
    const cy = height / 2;

    const bgRect = this.add.rectangle(cx, cy, width, height, 0x000000);
    bgRect.setDepth(0);

    const barW = 400, barH = 24;
    this.add.rectangle(cx, cy, barW + 4, barH + 4, 0x333333).setDepth(1);
    const bar  = this.add.rectangle(cx - barW / 2, cy, 0, barH, 0x4169e1)
      .setOrigin(0, 0.5)
      .setDepth(2);

    this.add.text(cx, cy - 60, 'METAL RAPTORS', {
      fontFamily: 'Courier New',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2);

    const loadingText = this.add.text(cx, cy + 40, 'LOADING...', {
      fontFamily: 'Courier New',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(2);

    this.load.on('progress', (value: number) => {
      bar.width = barW * value;
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      loadingText.setText(`Loading: ${file.key}`);
    });
  }
}
