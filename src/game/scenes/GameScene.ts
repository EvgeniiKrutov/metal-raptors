import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';
import { Plane }       from '../entities/Plane';
import { PlayerPlane } from '../entities/PlayerPlane';
import { EnemyPlane }  from '../entities/EnemyPlane';
import { AIContext }   from '../entities/EnemyPlane';
import { Bullet }      from '../entities/Bullet';
import { ParallaxSystem } from '../systems/ParallaxSystem';
import { CombatSystem }   from '../systems/CombatSystem';
import { InterpolationSystem } from '../systems/InterpolationSystem';
import { LevelManager } from '../systems/LevelManager';
import { gameEvents, EVENTS } from '../Game';
import { ControlState, LevelConfig } from '../../types/game.types';
import { isTouchDevice, backgroundLayerPaths, backgroundLayerKeys } from '../utils/helpers';
import { getLevelById, getLevels } from '../config/data/levels/index';
import { UIScene } from './UIScene';

const EXPLOSION_FRAME_WIDTH = 186;
const GROUND_EXPLOSION_Y_OFFSET = 30;

export class GameScene extends Phaser.Scene {
  player!: PlayerPlane;
  bullets!: Phaser.Physics.Arcade.Group;
  enemyBullets!: Phaser.Physics.Arcade.Group;

  parallaxSystem!: ParallaxSystem;
  combatSystem!: CombatSystem;
  interpolationSystem!: InterpolationSystem;
  levelManager!: LevelManager;

  private levelId!: string;
  private level!: LevelConfig;

  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
  };

  private isGameOver: boolean = false;
  private useTouch: boolean = false;

  private pendingOutcome: 'VICTORY' | 'DEFEAT' | null = null;
  private crashingPlane: Plane | null = null;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { levelId?: string }): void {
    const fallback = getLevels()[0];
    this.levelId = data?.levelId ?? fallback.id;
    this.level = getLevelById(this.levelId) ?? fallback;
    this.levelId = this.level.id;
  }

  preload(): void {
    const paths = backgroundLayerPaths(this.level.background, this.level.backgroundVariant);
    const keys  = backgroundLayerKeys(this.level.background, this.level.backgroundVariant);

    if (!this.textures.exists(keys.bg))     this.load.image(keys.bg, paths.bg);
    if (!this.textures.exists(keys.fg))     this.load.image(keys.fg, paths.fg);
    if (!this.textures.exists(keys.ground)) this.load.image(keys.ground, paths.ground);
  }

  create(): void {
    const { world, camera } = gameConfig;
    const keys = backgroundLayerKeys(this.level.background, this.level.backgroundVariant);

    this.isGameOver     = false;
    this.useTouch       = isTouchDevice();
    this.pendingOutcome = null;
    this.crashingPlane  = null;

    this.physics.world.setBounds(0, 0, world.width, world.height);
    this.physics.world.gravity.set(0, 0);

    this.interpolationSystem = new InterpolationSystem(this);

    this.parallaxSystem = new ParallaxSystem(this);
    this.parallaxSystem.create(keys.bg, keys.fg);

    this.createGroundVisual(keys.ground);

    this.bullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 120,
      runChildUpdate: false,
    });

    this.enemyBullets = this.physics.add.group({
      classType: Bullet,
      maxSize: 120,
      runChildUpdate: false,
    });

    this.player = new PlayerPlane(
      this,
      world.width * 0.2,
      world.height * 0.1,
      gameConfig.player,
    );

    this.interpolationSystem.register(this.player);

    this.player.on('fire', (x: number, y: number, angle: number) => {
      this.spawnBullet(x, y, angle);
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, world.width, world.height);
    cam.setRoundPixels(false);
    cam.startFollow(
      this.player,
      true,
      camera.lerp,
      camera.lerp,
    );

    this.applyCameraZoom();
    this.scale.on('resize', this.handleResize, this);

    const kb = this.input.keyboard!;
    this.keys = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      F: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
    };

    this.combatSystem = new CombatSystem(this);

    this.registry.set('playerHealth',    gameConfig.player.health);
    this.registry.set('playerMaxHealth', gameConfig.player.health);
    this.registry.set('enemies', []);

    this.levelManager = new LevelManager(
      this,
      this.level,
      this.player,
      this.interpolationSystem,
      {
        onStageChanged: (stageIndex, totalStages) => {
          this.registry.set('stageInfo', {
            stageIndex,
            totalStages,
            remaining: this.levelManager.getRemainingCount(),
          });
        },
        onLevelCompleted: () => this.triggerVictory(),
      },
    );
    this.levelManager.start();

    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.launch('UIScene');

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
    if (this.isGameOver) {
      this.updateGameOver(delta);
      return;
    }

    const { world } = gameConfig;
    const groundY = world.height - 80;
    const cam = this.cameras.main;

    const inputState = this.useTouch
      ? this.readTouchInput()
      : this.readKeyboardInput();

    this.player.handleInput(inputState, delta);
    this.player.updatePhysics(delta);

    this.registry.set('playerSpeed', this.player.currentSpeed);
    this.registry.set('playerAltitude', Math.max(0, groundY - this.player.y));

    this.levelManager.update(delta);
    if (this.isGameOver) return;

    this.updateEnemyAI(delta);
    const enemies = this.levelManager.getActiveEnemies();

    this.player.updateSmoke();

    if (this.player.x < 0)           this.player.x = world.width;
    if (this.player.x > world.width) this.player.x = 0;

    if (this.player.y < 20) {
      this.player.y = 20;
      if (this.player.verticalDrift < 0) this.player.verticalDrift = 0;
    }

    if (this.player.y >= groundY) {
      this.triggerDefeat(this.player, 'ground');
      return;
    }

    const groundDestroyed = new Set<EnemyPlane>();
    const airDestroyed = new Set<EnemyPlane>();

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      if (enemy.y >= groundY) {
        enemy.takeDamage(enemy.currentHealth);
        groundDestroyed.add(enemy);
      }
    }

    const cull = this.getCameraCullBounds(cam, 64);
    this.bullets.getChildren().forEach((child) => {
      const bullet = child as Bullet;
      if (!bullet.active) return;
      if (
        bullet.x < cull.left || bullet.x > cull.right ||
        bullet.y < cull.top  || bullet.y > cull.bottom
      ) {
        bullet.deactivate();
      }
    });

    this.enemyBullets.getChildren().forEach((child) => {
      const bullet = child as Bullet;
      if (!bullet.active) return;
      if (
        bullet.x < cull.left || bullet.x > cull.right ||
        bullet.y < cull.top  || bullet.y > cull.bottom ||
        bullet.y >= groundY
      ) {
        bullet.deactivate();
      }
    });

    const hits = this.combatSystem.checkBulletEnemiesCollision(this.bullets, enemies);
    for (const hit of hits) {
      if (hit.killed) {
        if (!groundDestroyed.has(hit.enemy)) airDestroyed.add(hit.enemy);
      } else {
        hit.enemy.onDamaged(this.buildAIContext(hit.enemy));
      }
    }

    for (const enemy of groundDestroyed) {
      this.explodeEnemy(enemy, false);
    }
    for (const enemy of airDestroyed) {
      this.explodeEnemy(enemy, true);
    }

    const playerHit = this.combatSystem.checkEnemyBulletPlayerCollision(
      this.enemyBullets,
      this.player,
    );

    if (playerHit) {
      this.registry.set('playerHealth', this.player.currentHealth);
      gameEvents.emit(EVENTS.PLAYER_HEALTH_CHANGED, {
        current: this.player.currentHealth,
        max: this.player.maxHealth,
      });

      if (this.player.isAlive() && this.player.getHealthPercent() <= 0.3) {
        cam.shake(200, 0.004);
      }

      if (!this.player.isAlive()) {
        this.triggerDefeat(this.player, 'fall');
        return;
      }
    }

    this.writeEnemyRegistry(cam);

    this.parallaxSystem.update(cam, this.player.y);
  }

  private updateEnemyAI(delta: number): void {
    const { world } = gameConfig;
    const enemies = this.levelManager.getActiveEnemies();

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      enemy.updateAI(delta, this.buildAIContext(enemy));
      enemy.updateSmoke();

      if (enemy.x < 0)           enemy.x = world.width;
      if (enemy.x > world.width) enemy.x = 0;
    }
  }

  private buildAIContext(enemy: EnemyPlane): AIContext {
    const cam = this.cameras.main;
    return {
      target: {
        x: this.player.x,
        y: this.player.y,
        rotation: this.player.rotation,
        body: this.player.body as Phaser.Physics.Arcade.Body,
      },
      threats: this.bullets,
      targetVisible: this.isInCameraView(this.player, cam),
      enemyVisible:  this.isInCameraView(enemy, cam),
      groundY: gameConfig.world.height - 80,
    };
  }

  private applyCameraZoom(): void {
    const referenceViewHeight = gameConfig.display.height;
    this.cameras.main.setZoom(this.scale.height / referenceViewHeight);
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.applyCameraZoom();
  }

  private writeEnemyRegistry(cam: Phaser.Cameras.Scene2D.Camera): void {
    const view = cam.worldView;
    const descriptors = this.levelManager.getActiveEnemies()
      .filter((enemy) => enemy.isAlive())
      .map((enemy) => ({
        screenX: ((enemy.x - view.x) / view.width)  * cam.width,
        screenY: ((enemy.y - view.y) / view.height) * cam.height,
        percent: enemy.getHealthPercent(),
      }));

    this.registry.set('enemies', descriptors);
    this.registry.set('stageInfo', {
      stageIndex: this.levelManager.getStageIndex(),
      totalStages: this.levelManager.getTotalStages(),
      remaining: this.levelManager.getRemainingCount(),
    });
  }

  private explodeEnemy(enemy: EnemyPlane, inAir: boolean): void {
    if (!enemy.visible) return;
    const key = inAir ? 'explosion_air' : 'explosion';
    this.spawnExplosion(enemy.x, enemy.y, enemy.displayWidth, 0.5, false, key);
    enemy.hideWreck();
    this.levelManager.removeEnemy(enemy);
  }

  private readKeyboardInput(): ControlState {
    return {
      up:    this.keys.W.isDown,
      down:  this.keys.S.isDown,
      left:  this.keys.A.isDown,
      right: this.keys.D.isDown,
      fire:  this.keys.F.isDown,
    };
  }

  private readTouchInput(): ControlState {
    const ui = this.scene.get('UIScene') as UIScene | undefined;
    if (ui && ui.scene.isActive() && ui.isTouchActive()) {
      return ui.getControlState();
    }
    return { up: false, down: false, left: false, right: false, fire: false };
  }

  spawnBullet(x: number, y: number, angle: number): void {
    const bullet = this.bullets.get(x, y) as Bullet;
    if (bullet) {
      bullet.fire(x, y, angle, gameConfig.bullet.speed, gameConfig.player.damage);
      this.sound.play('bullet_shot');
    }
  }

  spawnEnemyBullet(x: number, y: number, angle: number): void {
    const bullet = this.enemyBullets.get(x, y) as Bullet;
    if (bullet) {
      bullet.fire(x, y, angle, gameConfig.bullet.speed, gameConfig.enemy.damage);
    }
  }

  private isInCameraView(gameObject: Phaser.GameObjects.GameObject & { x: number; y: number }, camera: Phaser.Cameras.Scene2D.Camera): boolean {
    return camera.worldView.contains(gameObject.x, gameObject.y);
  }

  private getCameraCullBounds(
    camera: Phaser.Cameras.Scene2D.Camera,
    margin: number,
  ): { left: number; right: number; top: number; bottom: number } {
    const view = camera.worldView;
    return {
      left:   view.x - margin,
      right:  view.x + view.width  + margin,
      top:    view.y - margin,
      bottom: view.y + view.height + margin,
    };
  }

  private createGroundVisual(groundKey: string): void {
    const { world } = gameConfig;
    const groundY = world.height - 45;

    this.add.tileSprite(0, groundY, world.width, 50, groundKey)
      .setOrigin(0, 0)
      .setDepth(-50);
  }

  private triggerVictory(): void {
    if (this.isGameOver) return;
    this.isGameOver     = true;
    this.pendingOutcome = 'VICTORY';

    this.time.delayedCall(800, () => {
      this.scene.pause();
      gameEvents.emit(EVENTS.GAME_OVER, {
        outcome: this.pendingOutcome,
        levelId: this.levelId,
      });
    });
  }

  private triggerDefeat(plane: Plane, cause: 'fall' | 'ground'): void {
    if (this.isGameOver) return;
    this.isGameOver     = true;
    this.pendingOutcome = 'DEFEAT';

    this.registry.set('enemies', []);
    this.interpolationSystem.unregister(plane);

    const cam = this.cameras.main;
    cam.startFollow(this.player, true, gameConfig.camera.lerp, gameConfig.camera.lerp);

    switch (cause) {
      case 'ground': {
        const groundY = gameConfig.world.height - 80;
        this.spawnExplosion(plane.x, groundY + GROUND_EXPLOSION_Y_OFFSET, plane.displayWidth, 1, true);
        plane.hideWreck();
        break;
      }
      case 'fall':
        plane.startCrash();
        this.crashingPlane = plane;
        break;
    }
  }

  private updateGameOver(delta: number): void {
    this.updateEnemyAI(delta);

    const plane = this.crashingPlane;
    if (!plane) return;

    const groundY = gameConfig.world.height - 80;
    const reachedGround = plane.updateCrash(delta, groundY);

    this.parallaxSystem.update(this.cameras.main, plane.y);

    if (reachedGround) {
      this.spawnExplosion(plane.x, groundY + GROUND_EXPLOSION_Y_OFFSET, plane.displayWidth, 1, true);
      plane.hideWreck();
      this.crashingPlane = null;
    }
  }

  private spawnExplosion(
    x: number,
    y: number,
    planeSize: number,
    originY: number,
    endsGame: boolean,
    key: string = 'explosion',
  ): void {
    const boom = this.add.sprite(x, y, key, 0);
    boom.setOrigin(0.5, originY);
    boom.setScale((planeSize / EXPLOSION_FRAME_WIDTH) * 1.5);
    boom.setDepth(20);
    boom.play(key);

    boom.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      boom.destroy();
      if (endsGame) {
        this.scene.pause();
        gameEvents.emit(EVENTS.GAME_OVER, {
          outcome: this.pendingOutcome,
          levelId: this.levelId,
        });
      }
    });
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
