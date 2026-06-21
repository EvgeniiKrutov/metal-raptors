import Phaser from 'phaser';
import VirtualJoyStick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';
import { gameConfig } from '../config/gameConfig';
import { healthColour, isTouchDevice } from '../utils/helpers';
import { ControlState } from '../../types/game.types';

const REFERENCE_HEIGHT = 1080;

const CONTROLS_ALPHA = 0.4;

const GAUGE_WIDTH = 220;
const GAUGE_HEIGHT = 195;
const GAUGE_MARGIN = 16;
const GAUGE_GAP = 8;
const GAUGE_FONT = '"Press Start 2P", monospace';
const GAUGE_TEXT_COLOUR = '#fddb7f';
const GAUGE_FONT_SIZE = 14;

const HP_BAR_WIDTH = 220;
const HP_BAR_HEIGHT = 22;

const STAGE_FONT_SIZE = 20;
const STAGE_MARGIN = 24;

const CONTROLS_FONT_SIZE = 14;
const CONTROLS_MARGIN = 24;

const JOY_BASE_RADIUS = 110;
const JOY_THUMB_RADIUS = 55;
const JOY_OFFSET = 180;
const JOY_SUPERSAMPLE = 4;
const JOY_BASE_FILL_ALPHA = 0.5;
const JOY_THUMB_FILL_ALPHA = 0.72;
const JOY_RING_ALPHA = 0.9;
const JOY_BASE_RING_WIDTH = 4;
const JOY_THUMB_RING_WIDTH = 3;
const JOY_THUMB_TINT = 0xdddddd;
const JOY_DEADZONE = 0.12;
const JOY_BASE_TEXTURE = 'joystickBase';
const JOY_THUMB_TEXTURE = 'joystickThumb';
const FIRE_RADIUS = 60;
const FIRE_OFFSET = 150;
const FIRE_FONT_SIZE = 20;
const MIN_CONTROL_SCALE = 0.55;

const ENEMY_BAR_WIDTH = 120;
const ENEMY_BAR_HEIGHT = 14;
const ENEMY_BAR_OFFSET = 44;
const ENEMY_BAR_CULL = 200;

interface EnemyBarDescriptor {
  screenX: number;
  screenY: number;
  percent: number;
}

interface StageInfo {
  stageIndex: number;
  totalStages: number;
  remaining: number;
}

export class UIScene extends Phaser.Scene {
  rexVirtualJoystick!: {
    add(scene: Phaser.Scene, config?: VirtualJoyStick.IConfig): VirtualJoyStick;
  };

  private playerBar!: Phaser.GameObjects.Graphics;
  private enemyBar!:  Phaser.GameObjects.Graphics;
  private controlsText!: Phaser.GameObjects.Text;
  private stageText!: Phaser.GameObjects.Text;
  private altitudeText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private speedGauge!: Phaser.GameObjects.Image;
  private altGauge!: Phaser.GameObjects.Image;

  private useTouchControls = false;
  private joystick?: VirtualJoyStick;
  private joyBase?: Phaser.GameObjects.Image;
  private joyThumb?: Phaser.GameObjects.Image;
  private fireGfx?: Phaser.GameObjects.Arc;
  private fireText?: Phaser.GameObjects.Text;
  private fireZone?: Phaser.GameObjects.Zone;
  private fireDown = false;

  private uiScale = 1;
  private screenW = 0;
  private gaugeFontPending = true;
  private hpBarX = 0;
  private hpBarY = 0;
  private hpBarW = 0;
  private hpBarH = 0;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.playerBar = this.add.graphics();
    this.enemyBar  = this.add.graphics();

    this.stageText = this.add.text(0, 0, '', {
      fontFamily: 'Courier New',
      fontSize: '20px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0).setAlpha(0.85);

    this.useTouchControls = isTouchDevice();

    this.controlsText = this.add.text(
      0, 0,
      this.useTouchControls
        ? 'Joystick — Move    Button — Fire'
        : 'W/S — Throttle/Brake    A/D — Rotate    F — Fire',
      {
        fontFamily: 'Courier New',
        fontSize: '14px',
        color: '#ffffff',
      },
    ).setOrigin(0.5, 0.5).setAlpha(0.45);

    this.speedGauge = this.add.image(0, 0, 'speedometer').setOrigin(0, 0);
    this.altGauge   = this.add.image(0, 0, 'speedometer').setOrigin(0, 0);

    const gaugeTextStyle = {
      fontFamily: GAUGE_FONT,
      fontSize: '14px',
      color: GAUGE_TEXT_COLOUR,
    };

    this.speedText    = this.add.text(0, 0, '', gaugeTextStyle).setOrigin(0.5);
    this.altitudeText = this.add.text(0, 0, '', gaugeTextStyle).setOrigin(0.5);

    if (this.useTouchControls) {
      this.createTouchControls();
    }

    this.layout();
    this.requestGaugeFont();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  private requestGaugeFont(): void {
    this.gaugeFontPending = true;

    const fontSet = document.fonts;
    if (!fontSet) {
      this.gaugeFontPending = false;
      return;
    }

    fontSet.load(`${GAUGE_FONT_SIZE}px "Press Start 2P"`).catch(() => undefined);
  }

  private isGaugeFontLoaded(): boolean {
    const fontSet = document.fonts;
    if (!fontSet) return false;

    let loaded = false;
    fontSet.forEach((face) => {
      if (face.family.replace(/["']/g, '') === 'Press Start 2P' && face.status === 'loaded') {
        loaded = true;
      }
    });
    return loaded;
  }

  private refreshGaugeFontMetrics(): void {
    if (!this.gaugeFontPending || !this.isGaugeFontLoaded()) return;
    this.speedText.style.update(true);
    this.altitudeText.style.update(true);
    this.gaugeFontPending = false;
  }

  private buildJoystickTexture(
    key: string,
    radius: number,
    fillColour: number,
    fillAlpha: number,
    ringWidth: number,
  ): void {
    if (this.textures.exists(key)) return;

    const ss = JOY_SUPERSAMPLE;
    const r  = radius * ss;
    const rw = ringWidth * ss;
    const size = Math.ceil(r * 2);

    const gfx = this.make.graphics({ x: 0, y: 0 }, false);
    gfx.fillStyle(fillColour, fillAlpha);
    gfx.fillCircle(r, r, r - rw);
    gfx.lineStyle(rw, 0xffffff, JOY_RING_ALPHA);
    gfx.strokeCircle(r, r, r - rw / 2);
    gfx.generateTexture(key, size, size);
    gfx.destroy();

    this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  }

  private createTouchControls(): void {
    this.buildJoystickTexture(
      JOY_BASE_TEXTURE, JOY_BASE_RADIUS, 0xffffff, JOY_BASE_FILL_ALPHA, JOY_BASE_RING_WIDTH,
    );
    this.buildJoystickTexture(
      JOY_THUMB_TEXTURE, JOY_THUMB_RADIUS, JOY_THUMB_TINT, JOY_THUMB_FILL_ALPHA, JOY_THUMB_RING_WIDTH,
    );

    this.joyBase  = this.add.image(0, 0, JOY_BASE_TEXTURE);
    this.joyThumb = this.add.image(0, 0, JOY_THUMB_TEXTURE);

    this.joystick = this.rexVirtualJoystick.add(this, {
      x: 0,
      y: 0,
      radius: JOY_BASE_RADIUS - JOY_THUMB_RADIUS,
      base: this.joyBase,
      thumb: this.joyThumb,
      dir: '8dir',
      forceMin: 16,
      fixed: true,
      enable: true,
    });

    this.fireGfx = this.add.circle(0, 0, FIRE_RADIUS, 0xff3030, CONTROLS_ALPHA)
      .setStrokeStyle(4, 0xffffff, CONTROLS_ALPHA + 0.2);

    this.fireText = this.add.text(0, 0, 'FIRE', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(CONTROLS_ALPHA + 0.4);

    this.fireZone = this.add.zone(0, 0, FIRE_RADIUS * 2, FIRE_RADIUS * 2)
      .setInteractive({ useHandCursor: true });

    this.fireZone.on('pointerdown', () => { this.fireDown = true; });
    this.fireZone.on('pointerup',   () => { this.fireDown = false; });
    this.fireZone.on('pointerout',  () => { this.fireDown = false; });
  }

  private layout(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.resize(w, h);

    const s = h / REFERENCE_HEIGHT;
    this.uiScale = s;
    this.screenW = w;

    const margin   = GAUGE_MARGIN * s;
    const gaugeW   = GAUGE_WIDTH * s;
    const gaugeH   = GAUGE_HEIGHT * s;
    const gaugeGap = GAUGE_GAP * s;

    const spdX    = margin;
    const altX    = margin + gaugeW + gaugeGap;
    const gaugeY  = margin;
    const centreY = gaugeY + gaugeH / 2;

    this.speedGauge.setPosition(spdX, gaugeY).setDisplaySize(gaugeW, gaugeH);
    this.altGauge.setPosition(altX, gaugeY).setDisplaySize(gaugeW, gaugeH);

    const gaugeFont = Math.max(8, Math.round(GAUGE_FONT_SIZE * s));
    this.speedText.setFontSize(gaugeFont).setPosition(spdX + gaugeW / 2, centreY);
    this.altitudeText.setFontSize(gaugeFont).setPosition(altX + gaugeW / 2, centreY);

    this.hpBarW = HP_BAR_WIDTH * s;
    this.hpBarH = HP_BAR_HEIGHT * s;
    this.hpBarX = altX + gaugeW + margin;
    this.hpBarY = centreY - this.hpBarH / 2;

    this.stageText
      .setFontSize(Math.max(10, Math.round(STAGE_FONT_SIZE * s)))
      .setPosition(w - STAGE_MARGIN * s, STAGE_MARGIN * s);

    this.controlsText
      .setFontSize(Math.max(9, Math.round(CONTROLS_FONT_SIZE * s)))
      .setPosition(w / 2, h - CONTROLS_MARGIN * s);

    if (this.useTouchControls) {
      this.layoutTouchControls(w, h);
    }
  }

  private layoutTouchControls(w: number, h: number): void {
    const cs = Math.max(this.uiScale, MIN_CONTROL_SCALE);

    const baseRadius  = JOY_BASE_RADIUS * cs;
    const thumbRadius = JOY_THUMB_RADIUS * cs;
    const jsOffset    = JOY_OFFSET * cs;
    const jsX = w - jsOffset;
    const jsY = h - jsOffset;

    this.joyBase?.setDisplaySize(baseRadius * 2, baseRadius * 2);
    this.joyThumb?.setDisplaySize(thumbRadius * 2, thumbRadius * 2);

    if (this.joystick) {
      const js = this.joystick as unknown as {
        setRadius?: (r: number) => void;
        setPosition?: (x: number, y: number) => void;
        x: number;
        y: number;
      };
      js.setRadius?.(baseRadius - thumbRadius);
      if (typeof js.setPosition === 'function') {
        js.setPosition(jsX, jsY);
      } else {
        js.x = jsX;
        js.y = jsY;
        this.joyBase?.setPosition(jsX, jsY);
        this.joyThumb?.setPosition(jsX, jsY);
      }
    }

    const fireRadius = FIRE_RADIUS * cs;
    const fbOffset   = FIRE_OFFSET * cs;
    const fbX = fbOffset;
    const fbY = h - fbOffset;

    this.fireGfx?.setRadius(fireRadius).setPosition(fbX, fbY);
    this.fireText
      ?.setFontSize(Math.max(10, Math.round(FIRE_FONT_SIZE * cs)))
      .setPosition(fbX, fbY);
    this.fireZone?.setPosition(fbX, fbY).setSize(fireRadius * 2, fireRadius * 2, true);
  }

  isTouchActive(): boolean {
    return this.useTouchControls;
  }

  getControlState(): ControlState {
    const js = this.joystick as unknown as {
      forceX: number;
      forceY: number;
      radius: number;
    } | undefined;

    if (!js) {
      return { up: false, down: false, left: false, right: false, fire: this.fireDown };
    }

    const radius = js.radius || 1;
    const nx = Phaser.Math.Clamp(js.forceX / radius, -1, 1);
    const ny = Phaser.Math.Clamp(js.forceY / radius, -1, 1);

    return {
      up:    false,
      down:  false,
      left:  false,
      right: false,
      fire:  this.fireDown,
      throttle: this.applyDeadzone(Math.max(0, nx)),
      pitch:    this.applyDeadzone(ny),
    };
  }

  private applyDeadzone(value: number): number {
    const magnitude = Math.abs(value);
    if (magnitude <= JOY_DEADZONE) return 0;
    const scaled = (magnitude - JOY_DEADZONE) / (1 - JOY_DEADZONE);
    return Math.sign(value) * Math.min(1, scaled);
  }

  update(): void {
    this.refreshGaugeFontMetrics();

    const pH   = this.registry.get('playerHealth')    as number ?? gameConfig.player.health;
    const pMax = this.registry.get('playerMaxHealth') as number ?? gameConfig.player.health;

    this.playerBar.clear();
    this.drawHealthBar(
      this.playerBar,
      this.hpBarX, this.hpBarY,
      this.hpBarW, this.hpBarH,
      pH / pMax,
      healthColour(pH / pMax),
    );

    this.enemyBar.clear();
    const enemies = (this.registry.get('enemies') as EnemyBarDescriptor[]) ?? [];
    const s    = this.uiScale;
    const barW = ENEMY_BAR_WIDTH * s;
    const barH = ENEMY_BAR_HEIGHT * s;
    const cull = ENEMY_BAR_CULL * s;

    for (const enemy of enemies) {
      if (enemy.screenX <= -cull || enemy.screenX >= this.screenW + cull) {
        continue;
      }
      this.drawHealthBar(
        this.enemyBar,
        enemy.screenX - barW / 2,
        enemy.screenY - ENEMY_BAR_OFFSET * s,
        barW, barH,
        enemy.percent,
        0xdc143c,
      );
    }

    const altitude = Math.round((this.registry.get('playerAltitude') as number) ?? 0);
    const speed    = Math.round((this.registry.get('playerSpeed')    as number) ?? 0);
    this.altitudeText.setText(`${altitude}m`);
    this.speedText.setText(`${speed}km/h`);

    const stage = this.registry.get('stageInfo') as StageInfo | undefined;
    if (stage) {
      this.stageText.setText(
        `Stage ${stage.stageIndex + 1}/${stage.totalStages} — ${stage.remaining} left`,
      );
    } else {
      this.stageText.setText('');
    }
  }

  private drawHealthBar(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    width: number, height: number,
    percent: number,
    fillColour: number,
  ): void {
    const clamped = Math.max(0, Math.min(1, percent));

    gfx.fillStyle(0x000000, 0.6);
    gfx.fillRect(x - 2, y - 2, width + 4, height + 4);

    gfx.fillStyle(0x222222);
    gfx.fillRect(x, y, width, height);

    gfx.fillStyle(fillColour);
    gfx.fillRect(x, y, Math.floor(width * clamped), height);

    gfx.lineStyle(2, 0xffffff, 0.8);
    gfx.strokeRect(x, y, width, height);
  }
}
