import Phaser from 'phaser';
import VirtualJoyStick from 'phaser3-rex-plugins/plugins/virtualjoystick.js';
import { gameConfig } from '../config/gameConfig';
import { healthColour, isTouchDevice } from '../utils/helpers';
import { ControlState } from '../../types/game.types';

const CONTROLS_ALPHA = 0.4;

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

  private useTouchControls = false;
  private joystick?: VirtualJoyStick;
  private fireDown = false;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    this.playerBar    = this.add.graphics();
    this.enemyBar     = this.add.graphics();

    this.stageText = this.add.text(
      gameConfig.display.width - 24,
      24,
      '',
      {
        fontFamily: 'Courier New',
        fontSize: '20px',
        color: '#ffffff',
        stroke: '#000000',
        strokeThickness: 3,
      },
    ).setOrigin(1, 0).setAlpha(0.85);

    this.useTouchControls = isTouchDevice();

    this.controlsText = this.add.text(
      gameConfig.display.width / 2,
      gameConfig.display.height - 24,
      this.useTouchControls
        ? 'Joystick — Move    Button — Fire'
        : 'W/S — Throttle/Brake    A/D — Rotate    F — Fire',
      {
        fontFamily: 'Courier New',
        fontSize: '14px',
        color: '#ffffff',
      },
    ).setOrigin(0.5, 0.5).setAlpha(0.45);

    this.add.text(20, 58, 'SPD', {
      fontFamily: 'Courier New',
      fontSize: '12px',
      color: '#aaaaaa',
    });

    if (this.useTouchControls) {
      this.createTouchControls();
    }
  }

  /** Builds the bottom-left joystick and bottom-right fire button (touch devices only). */
  private createTouchControls(): void {
    const { height } = gameConfig.display;

    // --- Joystick (bottom-left) ---
    const jsX = 180;
    const jsY = height - 180; // ~900 on a 1080-tall screen
    const baseRadius  = 110;
    const thumbRadius = 55;

    const base = this.add.circle(0, 0, baseRadius, 0xffffff, CONTROLS_ALPHA)
      .setStrokeStyle(4, 0xffffff, CONTROLS_ALPHA + 0.2);
    const thumb = this.add.circle(0, 0, thumbRadius, 0xcccccc, CONTROLS_ALPHA + 0.15)
      .setStrokeStyle(3, 0xffffff, CONTROLS_ALPHA + 0.2);

    this.joystick = this.rexVirtualJoystick.add(this, {
      x: jsX,
      y: jsY,
      radius: baseRadius - thumbRadius,
      base,
      thumb,
      dir: '8dir',
      forceMin: 16,
      fixed: true,
      enable: true,
    });

    // --- Fire button (bottom-right) ---
    const fbX = gameConfig.display.width - 180; // ~1740
    const fbY = height - 180;                   // ~900
    const fireButton = this.add.circle(fbX, fbY, 90, 0xff3030, CONTROLS_ALPHA)
      .setStrokeStyle(4, 0xffffff, CONTROLS_ALPHA + 0.2)
      .setInteractive({ useHandCursor: true });

    this.add.text(fbX, fbY, 'FIRE', {
      fontFamily: 'Courier New',
      fontSize: '28px',
      color: '#ffffff',
    }).setOrigin(0.5).setAlpha(CONTROLS_ALPHA + 0.4);

    // Hold-to-fire: continuous while pressed, gated downstream by fireRate.
    fireButton.on('pointerdown', () => { this.fireDown = true; });
    fireButton.on('pointerup',   () => { this.fireDown = false; });
    fireButton.on('pointerout',  () => { this.fireDown = false; });
  }

  /** Whether on-screen touch controls are active for this session. */
  isTouchActive(): boolean {
    return this.useTouchControls;
  }

  /**
   * Current touch input intent, mapped per the agreed scheme:
   *   joystick right -> throttle (up)   left -> brake  (down)
   *   joystick up    -> rotate left     down -> rotate right
   * (UIScene reads the joystick; GameScene re-maps to plane actions identically
   * to the keyboard's WASD, so PlayerPlane.handleInput stays device-agnostic.)
   */
  getControlState(): ControlState {
    const js = this.joystick;
    return {
      up:    !!js && js.right, // throttle  (W)
      down:  !!js && js.left,  // brake     (S)
      left:  !!js && js.up,    // rotate CCW (A)
      right: !!js && js.down,  // rotate CW  (D)
      fire:  this.fireDown,
    };
  }

  update(): void {
    const pH   = this.registry.get('playerHealth')    as number ?? gameConfig.player.health;
    const pMax = this.registry.get('playerMaxHealth') as number ?? gameConfig.player.health;

    this.playerBar.clear();

    this.drawLabel(this.playerBar, 20, 22, 'HP');
    this.drawHealthBar(
      this.playerBar,
      60, 20,
      220, 22,
      pH / pMax,
      healthColour(pH / pMax),
    );

    this.enemyBar.clear();
    const enemies = (this.registry.get('enemies') as EnemyBarDescriptor[]) ?? [];
    const barW = 120;

    for (const enemy of enemies) {
      if (enemy.screenX <= -200 || enemy.screenX >= gameConfig.display.width + 200) {
        continue;
      }
      this.drawHealthBar(
        this.enemyBar,
        enemy.screenX - barW / 2,
        enemy.screenY - 44,
        barW, 14,
        enemy.percent,
        0xdc143c,
      );
    }

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

  private drawLabel(
    gfx: Phaser.GameObjects.Graphics,
    x: number, y: number,
    text: string,
  ): void {
    void gfx; void x; void y; void text;
  }
}
