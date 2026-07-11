import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';
import { PlayerPlane } from '../entities/PlayerPlane';
import { RibbonOpponentPlane, RibbonAIContext, RibbonArenaBounds } from '../entities/RibbonOpponentPlane';
import { Ribbon, RibbonPoint } from '../entities/Ribbon';
import { InterpolationSystem } from '../systems/InterpolationSystem';
import { SoundSystem } from '../systems/SoundSystem';
import { MusicSystem } from '../systems/MusicSystem';
import { gameEvents, EVENTS } from '../Game';
import { ControlState, RibbonLevelConfig } from '../../types/game.types';
import { isTouchDevice, backgroundLayerPaths, backgroundLayerKeys } from '../utils/helpers';
import { getRibbonLevels, getRibbonLevelById } from '../config/data/ribbon/levels/index';
import { UIScene } from './UIScene';

const REFERENCE_HEIGHT = 1080;
const SKY_OVERSCAN = 160;
const SKY_SHIFT_RANGE = 140;

const ARENA_MARGIN = 20;
const CEILING = 20;

const CUT_COOLDOWN_MS = 250;
const GAME_OVER_DELAY_MS = 900;
const DEFAULT_TIME_LIMIT_MS = 120000;

const SCORE_POP_RISE = 60;
const SCORE_POP_MS = 800;

type Side = 'player' | 'enemy';

export class RibbonScene extends Phaser.Scene {
  player!: PlayerPlane;
  opponent!: RibbonOpponentPlane;

  interpolationSystem!: InterpolationSystem;
  soundSystem!: SoundSystem;
  musicSystem!: MusicSystem;

  private levelId!: string;
  private level!: RibbonLevelConfig;

  private playerRibbon!: Ribbon;
  private enemyRibbon!: Ribbon;

  private playerScore = 0;
  private enemyScore = 0;

  private timeLeftMs = DEFAULT_TIME_LIMIT_MS;
  private suddenDeath = false;

  private prevPlayerNose!: RibbonPoint;
  private prevEnemyNose!: RibbonPoint;
  private playerCutCooldown = 0;
  private enemyCutCooldown = 0;

  private sky!: Phaser.GameObjects.Image;
  private skyNeutralY = 0;

  private keys!: {
    A: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  private isGameOver = false;
  private useTouch = false;
  private pendingOutcome: 'VICTORY' | 'DEFEAT' | null = null;

  constructor() {
    super({ key: 'RibbonScene' });
  }

  init(data: { levelId?: string }): void {
    const fallback = getRibbonLevels()[0];
    this.levelId = data?.levelId ?? fallback.id;
    this.level = getRibbonLevelById(this.levelId) ?? fallback;
    this.levelId = this.level.id;
  }

  preload(): void {
    const paths = backgroundLayerPaths(this.level.background, this.level.backgroundVariant);
    const keys  = backgroundLayerKeys(this.level.background, this.level.backgroundVariant);
    if (!this.textures.exists(keys.bg)) this.load.image(keys.bg, paths.bg);

    const sprite = this.level.ribbon.sprite;
    if (sprite && !this.textures.exists(this.ribbonSpriteKey())) {
      this.load.image(this.ribbonSpriteKey(), sprite);
    }
  }

  create(): void {
    const { world, camera } = gameConfig;

    this.isGameOver     = false;
    this.useTouch       = isTouchDevice();
    this.pendingOutcome = null;
    this.playerScore    = 0;
    this.enemyScore     = 0;
    this.playerCutCooldown = 0;
    this.enemyCutCooldown  = 0;
    this.timeLeftMs  = this.level.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
    this.suddenDeath = false;

    this.physics.world.setBounds(0, 0, world.width, world.height);
    this.physics.world.gravity.set(0, 0);

    this.interpolationSystem = new InterpolationSystem(this);

    this.createSky();

    this.player = new PlayerPlane(
      this,
      world.width * 0.3,
      world.height * 0.45,
      gameConfig.player,
    );
    this.player.setRotation(0);

    this.opponent = new RibbonOpponentPlane(
      this,
      world.width * 0.7,
      world.height * 0.45,
      this.level.opponent,
    );

    this.interpolationSystem.register(this.player);
    this.interpolationSystem.register(this.opponent);

    const spriteKey = this.level.ribbon.sprite ? this.ribbonSpriteKey() : undefined;
    this.playerRibbon = new Ribbon(this, this.level.ribbon, this.tailOf(this.player), spriteKey);
    this.enemyRibbon  = new Ribbon(this, this.level.ribbon, this.tailOf(this.opponent), spriteKey);

    this.prevPlayerNose = this.noseOf(this.player);
    this.prevEnemyNose  = this.noseOf(this.opponent);

    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width, world.height);
    cam.setRoundPixels(false);
    cam.startFollow(this.player, true, camera.lerp, camera.lerp);

    this.applyCameraZoom();
    this.scale.on('resize', this.handleResize, this);

    const kb = this.input.keyboard!;
    this.keys = {
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };

    this.soundSystem = new SoundSystem(this, world.width);
    this.soundSystem.start(this.player);

    this.musicSystem = new MusicSystem(this);
    this.musicSystem.start(this.level.music);

    this.registry.set('ribbonScores', { player: 0, enemy: 0 });
    this.registry.set('ribbonTimeLeft', this.timeLeftMs);
    this.registry.set('ribbonSuddenDeath', false);

    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.launch('UIScene', { variant: 'ribbon' });

    kb.on('keydown-ESC', this.handlePause, this);

    gameEvents.once(EVENTS.RESTART_GAME, this.handleRestart, this);
    gameEvents.once(EVENTS.EXIT_TO_MENU, this.handleExit, this);
    gameEvents.on(EVENTS.PAUSE_GAME, this.handlePause, this);
    gameEvents.on(EVENTS.RESUME_GAME, this.handleResume, this);
    this.events.once('shutdown', () => {
      gameEvents.off(EVENTS.RESTART_GAME, this.handleRestart, this);
      gameEvents.off(EVENTS.EXIT_TO_MENU, this.handleExit, this);
      gameEvents.off(EVENTS.PAUSE_GAME, this.handlePause, this);
      gameEvents.off(EVENTS.RESUME_GAME, this.handleResume, this);
      this.scale.off('resize', this.handleResize, this);
    });

    gameEvents.emit(EVENTS.GAME_STARTED);
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    if (!this.suddenDeath) {
      this.timeLeftMs = Math.max(0, this.timeLeftMs - delta);
      this.registry.set('ribbonTimeLeft', this.timeLeftMs);
      if (this.timeLeftMs <= 0) {
        this.resolveTimeUp();
        if (this.isGameOver) return;
      }
    }

    this.playerCutCooldown = Math.max(0, this.playerCutCooldown - delta);
    this.enemyCutCooldown  = Math.max(0, this.enemyCutCooldown - delta);

    const inputState = this.useTouch
      ? this.readTouchInput()
      : this.readKeyboardInput();

    this.player.handleInput(inputState, delta);
    this.player.updatePhysics();

    this.opponent.updateAI(delta, this.buildAIContext());

    this.clampToArena(this.player);
    this.clampToArena(this.opponent);

    this.soundSystem.update(delta, [this.opponent]);

    this.playerRibbon.update(this.tailOf(this.player));
    this.enemyRibbon.update(this.tailOf(this.opponent));

    const playerNose = this.noseOf(this.player);
    const enemyNose  = this.noseOf(this.opponent);

    if (this.playerCutCooldown <= 0) {
      const idx = this.findCutIndex(this.prevPlayerNose, playerNose, this.enemyRibbon);
      if (idx >= 0) this.handleCut('player', this.enemyRibbon, idx, playerNose);
    }

    if (!this.isGameOver && this.enemyCutCooldown <= 0) {
      const idx = this.findCutIndex(this.prevEnemyNose, enemyNose, this.playerRibbon);
      if (idx >= 0) this.handleCut('enemy', this.playerRibbon, idx, enemyNose);
    }

    this.prevPlayerNose = playerNose;
    this.prevEnemyNose  = enemyNose;

    this.updateSky();
  }

  private handleCut(cutter: Side, ribbon: Ribbon, segmentIndex: number, at: RibbonPoint): void {
    const chunkSegments = ribbon.cut(segmentIndex);
    if (chunkSegments <= 0) return;

    if (cutter === 'player') this.playerCutCooldown = CUT_COOLDOWN_MS;
    else                     this.enemyCutCooldown  = CUT_COOLDOWN_MS;

    const { scoring } = this.level;
    const fraction = Phaser.Math.Clamp(chunkSegments / this.level.ribbon.maxSegments, 0, 1);
    const points = Math.max(
      scoring.minPoints,
      Math.round(scoring.maxPoints * (1 - fraction)),
    );

    if (cutter === 'player') this.playerScore += points;
    else                     this.enemyScore  += points;

    this.registry.set('ribbonScores', {
      player: this.playerScore,
      enemy:  this.enemyScore,
    });

    this.spawnScorePop(at, points, cutter);

    if (this.suddenDeath) {
      this.triggerGameOver(cutter === 'player' ? 'VICTORY' : 'DEFEAT');
    }
  }

  private resolveTimeUp(): void {
    if (this.playerScore !== this.enemyScore) {
      this.triggerGameOver(this.playerScore > this.enemyScore ? 'VICTORY' : 'DEFEAT');
      return;
    }
    this.suddenDeath = true;
    this.registry.set('ribbonSuddenDeath', true);
  }

  private triggerGameOver(outcome: 'VICTORY' | 'DEFEAT'): void {
    if (this.isGameOver) return;
    this.isGameOver     = true;
    this.pendingOutcome = outcome;

    this.freezePlanes();

    this.soundSystem.enterGameOver();
    this.musicSystem.enterGameOver();
    this.cameras.main.flash(400, 255, 255, 255);

    this.time.delayedCall(GAME_OVER_DELAY_MS, () => {
      this.scene.pause();
      gameEvents.emit(EVENTS.GAME_OVER, {
        outcome: this.pendingOutcome,
        levelId: this.levelId,
      });
    });
  }

  private freezePlanes(): void {
    this.cameras.main.stopFollow();
    for (const plane of [this.player, this.opponent]) {
      plane.currentSpeed = 0;
      (plane.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0);
    }
  }

  private spawnScorePop(at: RibbonPoint, points: number, cutter: Side): void {
    const colour = cutter === 'player' ? '#9fff9f' : '#ff9f9f';
    const text = this.add.text(at.x, at.y, `+${points}`, {
      fontFamily: 'Courier New',
      fontSize: '32px',
      color: colour,
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(30);

    this.tweens.add({
      targets: text,
      y: at.y - SCORE_POP_RISE,
      alpha: 0,
      duration: SCORE_POP_MS,
      ease: 'Quad.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  private findCutIndex(prevNose: RibbonPoint, nose: RibbonPoint, ribbon: Ribbon): number {
    const points = ribbon.getPoints();
    if (points.length < 2) return -1;

    const noseLine = new Phaser.Geom.Line(prevNose.x, prevNose.y, nose.x, nose.y);
    const segment  = new Phaser.Geom.Line();

    for (let i = 0; i < points.length - 1; i++) {
      segment.setTo(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      if (Phaser.Geom.Intersects.LineToLine(noseLine, segment)) return i;
    }
    return -1;
  }

  private buildAIContext(): RibbonAIContext {
    return {
      playerX: this.player.x,
      playerY: this.player.y,
      playerRotation: this.player.rotation,
      ribbonPoints: this.playerRibbon.getPoints(),
      bounds: this.arenaBounds(),
    };
  }

  private arenaBounds(): RibbonArenaBounds {
    const { world } = gameConfig;
    return {
      left:   ARENA_MARGIN,
      right:  world.width - ARENA_MARGIN,
      top:    CEILING,
      bottom: world.height - ARENA_MARGIN,
    };
  }

  private clampToArena(plane: Phaser.GameObjects.Sprite): void {
    const bounds = this.arenaBounds();
    plane.x = Phaser.Math.Clamp(plane.x, bounds.left, bounds.right);
    plane.y = Phaser.Math.Clamp(plane.y, bounds.top, bounds.bottom);
  }

  private noseOf(plane: Phaser.GameObjects.Sprite): RibbonPoint {
    const halfLen = plane.displayWidth / 2;
    return {
      x: plane.x + Math.cos(plane.rotation) * halfLen,
      y: plane.y + Math.sin(plane.rotation) * halfLen,
    };
  }

  private tailOf(plane: Phaser.GameObjects.Sprite): RibbonPoint {
    const halfLen = plane.displayWidth / 2;
    return {
      x: plane.x - Math.cos(plane.rotation) * halfLen,
      y: plane.y - Math.sin(plane.rotation) * halfLen,
    };
  }

  private ribbonSpriteKey(): string {
    return `ribbon_sprite_${this.level.id}`;
  }

  private createSky(): void {
    const keys = backgroundLayerKeys(this.level.background, this.level.backgroundVariant);
    this.sky = this.add.image(0, 0, keys.bg)
      .setDepth(-100)
      .setOrigin(0);
    this.resizeSky();
  }

  private resizeSky(): void {
    const { width, height } = this.scale;
    const viewWidth = (width / height) * REFERENCE_HEIGHT;
    this.skyNeutralY = -SKY_OVERSCAN;
    this.sky.setDisplaySize(
      viewWidth + SKY_OVERSCAN * 2,
      REFERENCE_HEIGHT + SKY_OVERSCAN * 2,
    );
  }

  private updateSky(): void {
    const view = this.cameras.main.worldView;
    const bounds = this.arenaBounds();
    const t = Phaser.Math.Clamp(
      (this.player.y - bounds.top) / (bounds.bottom - bounds.top),
      0, 1,
    );
    this.sky.x = view.x - SKY_OVERSCAN;
    this.sky.y = view.y + this.skyNeutralY
      + Phaser.Math.Linear(SKY_SHIFT_RANGE, -SKY_SHIFT_RANGE, t);
  }

  private applyCameraZoom(): void {
    this.cameras.main.setZoom(this.scale.height / gameConfig.display.height);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.applyCameraZoom();
    this.resizeSky();
  }

  private readKeyboardInput(): ControlState {
    return {
      left:  this.keys.A.isDown,
      right: this.keys.D.isDown,
      fire:  false,
    };
  }

  private readTouchInput(): ControlState {
    const ui = this.scene.get('UIScene') as UIScene | undefined;
    if (ui && ui.scene.isActive() && ui.isTouchActive()) {
      const state = ui.getControlState();
      return { left: state.left, right: state.right, fire: false, targetHeading: state.targetHeading };
    }
    return { left: false, right: false, fire: false };
  }

  private handlePause(): void {
    if (this.isGameOver) return;
    if (this.scene.isPaused()) return;

    if (this.scene.isActive('UIScene')) {
      this.scene.pause('UIScene');
    }
    this.scene.pause();
    gameEvents.emit(EVENTS.GAME_PAUSED);
  }

  private handleResume(): void {
    if (!this.scene.isPaused()) return;

    if (this.scene.isPaused('UIScene')) {
      this.scene.resume('UIScene');
    }
    this.scene.resume();
  }

  private handleRestart(data?: { levelId?: string }): void {
    this.isGameOver = false;
    this.scene.stop('UIScene');
    this.scene.restart({ levelId: data?.levelId ?? this.levelId });
  }

  private handleExit(): void {
    this.isGameOver = false;
    this.scene.stop('UIScene');
    this.scene.start('PreloadScene');
  }
}
