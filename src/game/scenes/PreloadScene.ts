import Phaser from 'phaser';
import { gameEvents, EVENTS } from '../Game';
import { GUN_TRACE_COUNT, gunTraceKey, gunTracePath, isTouchDevice } from '../utils/helpers';
import { getPlanes, planeTextureKey } from '../config/data/planes/index';
import { getSelectedPlane } from '../utils/selectedPlane';

const PLANE_BASE_WIDTH = 150;
const PLANE_MOBILE_SCALE = 1.6;

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createLoadingUI();

    for (const plane of getPlanes()) {
      const key = planeTextureKey(plane.id);
      if (!this.textures.exists(key)) {
        this.load.image(key, plane.file);
      }
    }
    if (!this.textures.exists('enemy_temp')) {
      this.load.image('enemy_temp', 'sprites/planes/world_war_1/Fokker_Dr_1.png');
    }
    if (!this.textures.exists('smoke')) {
      this.load.image('smoke', 'effects/smoke.png');
    }
    if (!this.textures.exists('bullet')) {
      this.load.image('bullet', 'effects/bullet.png');
    }
    if (!this.textures.exists('speedometer')) {
      this.load.image('speedometer', 'interface/speedometer.png');
    }
    if (!this.textures.exists('explosion')) {
      this.load.spritesheet('explosion', 'effects/explosion.png', {
        frameWidth: 165,
        frameHeight: 196,
      });
    }
    if (!this.textures.exists('explosion_air')) {
      this.load.spritesheet('explosion_air', 'effects/explosion_air.png', {
        frameWidth: 165,
        frameHeight: 155,
      });
    }
    if (!this.cache.audio.exists('bullet_shot')) {
      this.load.audio('bullet_shot', 'sounds/bullet_shot_1.wav');
    }

    for (let i = 1; i <= GUN_TRACE_COUNT; i++) {
      const key = gunTraceKey(i);
      if (!this.textures.exists(key)) {
        this.load.image(key, gunTracePath(i));
      }
    }
  }

  create(): void {
    this.makeEnemyTexture();
    this.makeExplosionAnimation();

    gameEvents.once(EVENTS.START_GAME, ({ levelId }: { levelId: string }) => {
      this.buildPlayerTexture();
      this.scene.start('GameScene', { levelId });
    });
    gameEvents.emit(EVENTS.ASSETS_LOADED);
  }

  private makeExplosionAnimation(): void {
    if (!this.anims.exists('explosion')) {
      this.anims.create({
        key: 'explosion',
        frames: this.anims.generateFrameNumbers('explosion', { start: 0, end: 21 }),
        frameRate: 30,
        repeat: 0,
      });
    }

    if (!this.anims.exists('explosion_air')) {
      this.anims.create({
        key: 'explosion_air',
        frames: this.anims.generateFrameNumbers('explosion_air', { start: 0, end: 21 }),
        frameRate: 30,
        repeat: 0,
      });
    }
  }

  private makePlaneTexture(spriteName: string, planeName: string): void {
    this.textures.get(spriteName).setFilter(Phaser.Textures.FilterMode.LINEAR);

    const tempSprite = this.add.sprite(0, 0, spriteName);

    const baseWidth = PLANE_BASE_WIDTH * (isTouchDevice() ? PLANE_MOBILE_SCALE : 1);
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
    this.textures.get(planeName).setFilter(Phaser.Textures.FilterMode.LINEAR);

    tempSprite.destroy();
    rt.destroy();
  }

  private buildPlayerTexture(): void {
    if (this.textures.exists('player')) {
      this.textures.remove('player');
    }
    const plane = getSelectedPlane();
    this.makePlaneTexture(planeTextureKey(plane.id), 'player');
  }

  private makeEnemyTexture(): void {
    if (this.textures.exists('enemy')) return;
    this.makePlaneTexture('enemy_temp', 'enemy');
  }

  private createLoadingUI(): void {
    const barW = 400, barH = 24;

    const bgRect = this.add.rectangle(0, 0, 10, 10, 0x000000).setOrigin(0.5).setDepth(0);
    const barBack = this.add.rectangle(0, 0, barW + 4, barH + 4, 0x333333)
      .setOrigin(0.5).setDepth(1);
    const bar = this.add.rectangle(0, 0, 0, barH, 0x4169e1)
      .setOrigin(0, 0.5).setDepth(2);

    const title = this.add.text(0, 0, 'METAL RAPTORS', {
      fontFamily: 'Courier New',
      fontSize: '36px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(2);

    const loadingText = this.add.text(0, 0, 'LOADING...', {
      fontFamily: 'Courier New',
      fontSize: '14px',
      color: '#aaaaaa',
    }).setOrigin(0.5).setDepth(2);

    let progress = 0;

    const layout = () => {
      const w = this.scale.width;
      const h = this.scale.height;
      const cx = w / 2;
      const cy = h / 2;
      bgRect.setPosition(cx, cy).setSize(w, h);
      barBack.setPosition(cx, cy);
      bar.setPosition(cx - barW / 2, cy);
      bar.width = barW * progress;
      title.setPosition(cx, cy - 60);
      loadingText.setPosition(cx, cy + 40);
    };

    layout();
    this.scale.on('resize', layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', layout, this));

    this.load.on('progress', (value: number) => {
      progress = value;
      bar.width = barW * value;
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      loadingText.setText(`Loading: ${file.key}`);
    });
  }
}
