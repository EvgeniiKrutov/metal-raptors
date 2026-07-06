import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';
import { battlefieldWorld } from '../config/data/battlefield/world';
import { Plane }       from '../entities/Plane';
import { PlayerPlane } from '../entities/PlayerPlane';
import { EnemyPlane }  from '../entities/EnemyPlane';
import { AIContext }   from '../entities/EnemyPlane';
import { Bullet }      from '../entities/Bullet';
import { Bomb }        from '../entities/Bomb';
import { Machine }     from '../entities/Machine';
import { TerrainSystem }       from '../systems/TerrainSystem';
import { CombatSystem }        from '../systems/CombatSystem';
import { InterpolationSystem } from '../systems/InterpolationSystem';
import { BattlefieldLevelManager } from '../systems/BattlefieldLevelManager';
import { gameEvents, EVENTS } from '../Game';
import { ControlState, BattlefieldLevelConfig } from '../../types/game.types';
import { isTouchDevice } from '../utils/helpers';
import { getBattlefieldLevels, getBattlefieldLevelById } from '../config/data/battlefield/levels/index';
import { UIScene } from './UIScene';

const EXPLOSION_FRAME_WIDTH = 186;
const EXPLOSION_SCALE_FACTOR = 0.7;
const GROUND_EXPLOSION_SCALE = 1.8;
const BATTLEFIELD_SPEED_SCALE = 0.6;

const BULLET_PLANE_WIDTH_RATIO = 0.16;

export class BattlefieldScene extends Phaser.Scene {
  player!: PlayerPlane;
  bullets!: Phaser.Physics.Arcade.Group;
  enemyBullets!: Phaser.Physics.Arcade.Group;
  private bombs: Bomb[] = [];

  terrainSystem!: TerrainSystem;
  combatSystem!: CombatSystem;
  interpolationSystem!: InterpolationSystem;
  levelManager!: BattlefieldLevelManager;

  private levelId!: string;
  private level!: BattlefieldLevelConfig;

  private worldWidth: number = 0;
  private worldHeight: number = 0;

  private bulletDisplayWidth: number = 0;
  private bulletDisplayHeight: number = 0;
  private bulletSpeed: number = 0;

  private keys!: {
    A: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
    H: Phaser.Input.Keyboard.Key;
  };

  private isGameOver: boolean = false;
  private useTouch: boolean = false;

  private pendingOutcome: 'VICTORY' | 'DEFEAT' | null = null;
  private crashingPlane: Plane | null = null;

  constructor() {
    super({ key: 'BattlefieldScene' });
  }

  init(data: { levelId?: string }): void {
    const fallback = getBattlefieldLevels()[0];
    this.levelId = data?.levelId ?? fallback.id;
    this.level = getBattlefieldLevelById(this.levelId) ?? fallback;
    this.levelId = this.level.id;
  }

  preload(): void {
    const key  = this.mapKey();
    const path = `backgrounds/${this.level.map}/level_map.png`;
    if (!this.textures.exists(key)) this.load.image(key, path);
  }

  create(): void {
    const { camera, ceiling, tileWidth, tileHeight, widthTiles, planeScale, planeSpeed, fallScale } = battlefieldWorld;

    this.worldWidth  = tileWidth * widthTiles;
    this.worldHeight = tileHeight;

    this.isGameOver     = false;
    this.useTouch       = isTouchDevice();
    this.pendingOutcome = null;
    this.crashingPlane  = null;
    this.bombs          = [];

    this.physics.world.setBounds(0, 0, this.worldWidth, this.worldHeight);
    this.physics.world.gravity.set(0, 0);

    this.interpolationSystem = new InterpolationSystem(this);

    this.terrainSystem = new TerrainSystem(this, this.worldWidth, this.worldHeight);
    this.terrainSystem.create(this.mapKey(), this.level.ground);

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
      this.worldWidth * 0.2,
      this.worldHeight * 0.1,
      gameConfig.player,
    );
    this.player.setScale(planeScale);
    this.player.setSmokeScale(planeScale);
    this.player.setFallScale(fallScale);
    this.player.currentSpeed = planeSpeed * BATTLEFIELD_SPEED_SCALE;
    const enemySpeedScale = this.player.currentSpeed / gameConfig.player.maxSpeed;

    const bulletAspect = gameConfig.bullet.height / gameConfig.bullet.width;
    this.bulletDisplayWidth  = this.player.displayWidth * BULLET_PLANE_WIDTH_RATIO;
    this.bulletDisplayHeight = this.bulletDisplayWidth * bulletAspect;
    this.bulletSpeed         = gameConfig.bullet.speed * enemySpeedScale;

    this.interpolationSystem.register(this.player);

    this.player.on('fire', (x: number, y: number, angle: number) => {
      this.spawnBullet(x, y, angle);
    });

    this.player.on('bomb', (x: number, y: number, angle: number, speed: number) => {
      this.spawnBomb(x, y, angle, speed);
    });

    const cam = this.cameras.main;
    cam.setBounds(0, 0, this.worldWidth, this.worldHeight);
    cam.setRoundPixels(false);
    cam.startFollow(this.player, true, camera.lerp, camera.lerp);
    cam.setZoom(camera.zoom);
    this.scale.on('resize', this.handleResize, this);

    const kb = this.input.keyboard!;
    this.keys = {
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      F: kb.addKey(Phaser.Input.Keyboard.KeyCodes.F),
      H: kb.addKey(Phaser.Input.Keyboard.KeyCodes.H),
    };

    this.combatSystem = new CombatSystem(this);

    this.registry.set('playerHealth',    gameConfig.player.health);
    this.registry.set('playerMaxHealth', gameConfig.player.health);
    this.registry.set('bombCooldownRatio', 0);
    this.registry.set('enemies', []);

    this.levelManager = new BattlefieldLevelManager(
      this,
      this.level,
      this.player,
      this.interpolationSystem,
      this.terrainSystem,
      this.worldWidth,
      ceiling,
      planeScale,
      enemySpeedScale,
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

    const { ceiling } = battlefieldWorld;
    const cam = this.cameras.main;

    const inputState = this.useTouch
      ? this.readTouchInput()
      : this.readKeyboardInput();

    this.player.handleInput(inputState, delta);
    this.player.updatePhysics();

    if (this.player.x < 0) {
      this.player.x += this.worldWidth;
      cam.centerOn(this.player.x, cam.midPoint.y);
    } else if (this.player.x > this.worldWidth) {
      this.player.x -= this.worldWidth;
      cam.centerOn(this.player.x, cam.midPoint.y);
    }

    if (this.player.y < ceiling) {
      this.player.y = ceiling;
    }

    const playerGroundY = this.terrainSystem.groundYAt(this.player.x);
    this.registry.set('playerAltitude', Math.max(0, playerGroundY - this.player.y));

    if (this.player.y >= playerGroundY) {
      this.triggerDefeat(this.player, 'ground');
      return;
    }

    this.levelManager.update(delta);
    if (this.isGameOver) return;

    this.updateEnemyAI(delta);
    this.levelManager.updateMachines(delta);

    const enemies = this.levelManager.getActiveEnemies();
    const machines = this.levelManager.getActiveMachines();

    this.player.updateSmoke();

    const groundDestroyed = new Set<EnemyPlane>();
    const airDestroyed = new Set<EnemyPlane>();

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      if (enemy.y >= this.terrainSystem.groundYAt(enemy.x)) {
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
        bullet.y < cull.top  || bullet.y > cull.bottom ||
        bullet.y >= this.terrainSystem.groundYAt(bullet.x)
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
        bullet.y >= this.terrainSystem.groundYAt(bullet.x)
      ) {
        bullet.deactivate();
      }
    });

    const hits = this.combatSystem.checkBulletTargetsCollision(
      this.bullets,
      [...enemies, ...machines],
    );
    for (const hit of hits) {
      if (hit.target instanceof Machine) {
        if (hit.killed) this.explodeMachine(hit.target);
        continue;
      }

      const enemy = hit.target as EnemyPlane;
      if (hit.killed) {
        if (!groundDestroyed.has(enemy)) airDestroyed.add(enemy);
      } else {
        enemy.onDamaged(this.buildAIContext(enemy));
      }
    }

    for (const enemy of groundDestroyed) {
      this.explodeEnemy(enemy, false);
    }
    for (const enemy of airDestroyed) {
      this.explodeEnemy(enemy, true);
    }

    this.updateBombs();
    this.registry.set('bombCooldownRatio', this.player.getBombCooldownRatio());

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

    this.terrainSystem.update(cam);
  }

  private updateEnemyAI(delta: number): void {
    const enemies = this.levelManager.getActiveEnemies();

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      enemy.updateAI(delta, this.buildAIContext(enemy));
      enemy.updateSmoke();
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
      groundY: this.terrainSystem.groundYAt(enemy.x),
    };
  }

  private handleResize(gameSize: Phaser.Structs.Size): void {
    this.cameras.resize(gameSize.width, gameSize.height);
    this.cameras.main.setZoom(battlefieldWorld.camera.zoom);
  }

  private writeEnemyRegistry(cam: Phaser.Cameras.Scene2D.Camera): void {
    const view = cam.worldView;

    const enemyDescriptors = this.levelManager.getActiveEnemies()
      .filter((enemy) => enemy.isAlive())
      .map((enemy) => ({
        screenX: ((enemy.x - view.x) / view.width)  * cam.width,
        screenY: ((enemy.y - view.y) / view.height) * cam.height,
        percent: enemy.getHealthPercent(),
      }));

    const machineDescriptors = this.levelManager.getActiveMachines()
      .filter((machine) => machine.isAlive())
      .map((machine) => ({
        screenX: ((machine.x - view.x) / view.width) * cam.width,
        screenY: ((machine.y - machine.displayHeight - view.y) / view.height) * cam.height,
        percent: machine.getHealthPercent(),
      }));

    this.registry.set('enemies', [...enemyDescriptors, ...machineDescriptors]);
    this.registry.set('stageInfo', {
      stageIndex: this.levelManager.getStageIndex(),
      totalStages: this.levelManager.getTotalStages(),
      remaining: this.levelManager.getRemainingCount(),
    });
  }

  private explodeEnemy(enemy: EnemyPlane, inAir: boolean): void {
    if (!enemy.visible) return;
    if (inAir) {
      this.spawnExplosion(enemy.x, enemy.y, enemy.displayWidth, 0.5, false, 'explosion_air');
    } else {
      this.spawnExplosion(enemy.x, enemy.y, this.player.displayWidth, 0.5, false, 'explosion', GROUND_EXPLOSION_SCALE);
    }
    enemy.hideWreck();
    this.levelManager.removeEnemy(enemy);
  }

  private explodeMachine(machine: Machine): void {
    if (!machine.visible) return;
    this.spawnExplosion(machine.x, machine.y, this.player.displayWidth, 1, false, 'explosion', GROUND_EXPLOSION_SCALE);
    this.levelManager.removeMachine(machine);
  }

  private readKeyboardInput(): ControlState {
    return {
      left:  this.keys.A.isDown,
      right: this.keys.D.isDown,
      fire:  this.keys.F.isDown,
      bomb:  this.keys.H.isDown,
    };
  }

  private readTouchInput(): ControlState {
    const ui = this.scene.get('UIScene') as UIScene | undefined;
    if (ui && ui.scene.isActive() && ui.isTouchActive()) {
      return ui.getControlState();
    }
    return { left: false, right: false, fire: false, bomb: false };
  }

  spawnBullet(x: number, y: number, angle: number): void {
    const bullet = this.bullets.get(x, y) as Bullet;
    if (bullet) {
      bullet.fire(x, y, angle, this.bulletSpeed, gameConfig.player.damage);
      bullet.setDisplaySize(this.bulletDisplayWidth, this.bulletDisplayHeight);
      this.sound.play('bullet_shot');
    }
  }

  spawnEnemyBullet(x: number, y: number, angle: number): void {
    const bullet = this.enemyBullets.get(x, y) as Bullet;
    if (bullet) {
      bullet.fire(x, y, angle, this.bulletSpeed, gameConfig.enemy.damage);
      bullet.setDisplaySize(this.bulletDisplayWidth, this.bulletDisplayHeight);
    }
  }

  spawnBomb(x: number, y: number, angle: number, speed: number): void {
    const bomb = new Bomb(this, x, y, gameConfig.bomb);
    bomb.drop(angle, speed);
    this.bombs.push(bomb);
  }

  private updateBombs(): void {
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const bomb = this.bombs[i];
      bomb.faceVelocity();

      const groundY = this.terrainSystem.groundYAt(bomb.x);
      if (bomb.y >= groundY) {
        this.explodeBomb(bomb, groundY);
      } else if (
        bomb.x < 0 ||
        bomb.x > this.worldWidth ||
        bomb.y > this.worldHeight + 200
      ) {
        this.removeBomb(bomb);
      }
    }
  }

  private explodeBomb(bomb: Bomb, groundY: number): void {
    this.spawnExplosion(bomb.x, groundY, this.player.displayWidth, 1, false, 'explosion', GROUND_EXPLOSION_SCALE);
    this.applyBombDamage(bomb, groundY);
    this.removeBomb(bomb);
  }

  private applyBombDamage(bomb: Bomb, impactY: number): void {
    const machines = this.levelManager.getActiveMachines();
    const killedMachines: Machine[] = [];
    for (const machine of machines) {
      if (!machine.isAlive()) continue;
      if (Math.abs(machine.x - bomb.x) <= bomb.area) {
        if (machine.takeDamage(bomb.damage)) killedMachines.push(machine);
      }
    }
    for (const machine of killedMachines) this.explodeMachine(machine);

    const enemies = this.levelManager.getActiveEnemies();
    const killedEnemies: EnemyPlane[] = [];
    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;
      const horizontal = Math.abs(enemy.x - bomb.x);
      const altitude   = impactY - enemy.y;
      if (horizontal <= bomb.area && altitude >= 0 && altitude <= bomb.area) {
        if (enemy.takeDamage(bomb.damage)) killedEnemies.push(enemy);
        else enemy.onDamaged(this.buildAIContext(enemy));
      }
    }
    for (const enemy of killedEnemies) this.explodeEnemy(enemy, true);
  }

  private removeBomb(bomb: Bomb): void {
    const i = this.bombs.indexOf(bomb);
    if (i >= 0) this.bombs.splice(i, 1);
    bomb.destroy();
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

  private mapKey(): string {
    return `map_${this.level.map}`;
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
    cam.startFollow(this.player, true, battlefieldWorld.camera.lerp, battlefieldWorld.camera.lerp);

    switch (cause) {
      case 'ground': {
        const groundY = this.terrainSystem.groundYAt(plane.x);
        this.spawnExplosion(plane.x, groundY, plane.displayWidth, 1, true, 'explosion', GROUND_EXPLOSION_SCALE);
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

    const groundY = this.terrainSystem.groundYAt(plane.x);
    const reachedGround = plane.updateCrash(delta, groundY);

    this.terrainSystem.update(this.cameras.main);

    if (reachedGround) {
      this.spawnExplosion(plane.x, groundY, plane.displayWidth, 1, true, 'explosion', GROUND_EXPLOSION_SCALE);
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
    scale: number = 1,
  ): void {
    const boom = this.add.sprite(x, y, key, 0);
    boom.setOrigin(0.5, originY);
    boom.setScale((planeSize / EXPLOSION_FRAME_WIDTH) * EXPLOSION_SCALE_FACTOR * scale);
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
