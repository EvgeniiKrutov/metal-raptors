import Phaser from 'phaser';
import { gameConfig } from '../config/gameConfig';
import { PlayerPlane } from '../entities/PlayerPlane';
import { EnemyPlane }  from '../entities/EnemyPlane';
import { Bullet }      from '../entities/Bullet';
import { ParallaxSystem } from '../systems/ParallaxSystem';
import { CombatSystem }   from '../systems/CombatSystem';
import { InterpolationSystem } from '../systems/InterpolationSystem';
import { gameEvents, EVENTS } from '../Game';
import { EnemyBehaviorConfig, ControlState } from '../../types/game.types';
import { isTouchDevice } from '../utils/helpers';
import { UIScene } from './UIScene';
import fighterBehavior from '../config/data/enemies/fighter.json';

export class GameScene extends Phaser.Scene {
  player!: PlayerPlane;
  enemy!: EnemyPlane;
  bullets!: Phaser.Physics.Arcade.Group;
  enemyBullets!: Phaser.Physics.Arcade.Group;

  parallaxSystem!: ParallaxSystem;
  combatSystem!: CombatSystem;
  interpolationSystem!: InterpolationSystem;

  private keys!: {
    W: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
    F: Phaser.Input.Keyboard.Key;
  };

  private isGameOver: boolean = false;
  private useTouch: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    const { world, display, camera } = gameConfig;

    this.isGameOver = false;
    this.useTouch   = isTouchDevice();

    this.physics.world.setBounds(0, 0, world.width, world.height);
    this.physics.world.gravity.set(0, 0);

    this.interpolationSystem = new InterpolationSystem(this);

    this.parallaxSystem = new ParallaxSystem(this);
    this.parallaxSystem.create();

    this.createGroundVisual();

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

    const behavior = fighterBehavior as EnemyBehaviorConfig;
    this.enemy = new EnemyPlane(
      this,
      world.width * 0.75,
      world.height * 0.1,
      behavior,
    );

    this.interpolationSystem.register(this.enemy);

    this.enemy.on('fire', (x: number, y: number, angle: number) => {
      this.spawnEnemyBullet(x, y, angle);
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
    this.registry.set('enemyHealth',     this.enemy.maxHealth);
    this.registry.set('enemyMaxHealth',  this.enemy.maxHealth);
    this.registry.set('enemyScreenX',    display.width * 0.75);
    this.registry.set('enemyScreenY',    display.height * 0.45);

    if (this.scene.isActive('UIScene')) {
      this.scene.stop('UIScene');
    }
    this.scene.launch('UIScene');

    gameEvents.once(EVENTS.RESTART_GAME, this.handleRestart, this);
    this.events.once('shutdown', () => {
      gameEvents.off(EVENTS.RESTART_GAME, this.handleRestart, this);
    });

    gameEvents.emit(EVENTS.GAME_STARTED);
  }

  update(_time: number, delta: number): void {
    if (this.isGameOver) return;

    const { world } = gameConfig;
    const groundY = world.height - 80;

    const inputState = this.useTouch
      ? this.readTouchInput()
      : this.readKeyboardInput();

    this.player.handleInput(inputState, delta);
    this.player.updatePhysics(delta);

    const cam = this.cameras.main;
    const isPlayerVisible = this.isInCameraView(this.player, cam);
    const isEnemyVisible  = this.isInCameraView(this.enemy,  cam);
    const aiCtx = {
      target: {
        x: this.player.x,
        y: this.player.y,
        rotation: this.player.rotation,
        body: this.player.body as Phaser.Physics.Arcade.Body,
      },
      threats: this.bullets,
      targetVisible: isPlayerVisible,
      enemyVisible:  isEnemyVisible,
      groundY: world.height - 80,
    };
    this.enemy.updateAI(delta, aiCtx);

    this.player.updateSmoke();
    this.enemy.updateSmoke();

    if (this.player.x < 0)          this.player.x = world.width;
    if (this.player.x > world.width) this.player.x = 0;

    if (this.enemy.isAlive()) {
      if (this.enemy.x < 0)           this.enemy.x = world.width;
      if (this.enemy.x > world.width) this.enemy.x = 0;
    }

    if (this.player.y < 20) {
      this.player.y = 20;
      if (this.player.verticalDrift < 0) this.player.verticalDrift = 0;
    }

    if (this.player.y >= groundY) {
      this.triggerGameOver('DEFEAT');
      return;
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

    const hitOccurred = this.combatSystem.checkBulletEnemyCollision(
      this.bullets,
      this.enemy,
    );

    if (hitOccurred) {
      this.enemy.onDamaged(aiCtx);

      this.registry.set('enemyHealth', this.enemy.currentHealth);
      gameEvents.emit(EVENTS.ENEMY_HEALTH_CHANGED, {
        current: this.enemy.currentHealth,
        max: this.enemy.maxHealth,
      });

      if (!this.enemy.isAlive()) {
        this.triggerGameOver('VICTORY');
        return;
      }
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

      // Slight camera shake while the player is in critical (≤30%) health.
      if (this.player.isAlive() && this.player.getHealthPercent() <= 0.3) {
        cam.shake(200, 0.004);
      }

      if (!this.player.isAlive()) {
        this.triggerGameOver('DEFEAT');
        return;
      }
    }

    this.registry.set('enemyScreenX', this.enemy.x - cam.scrollX);
    this.registry.set('enemyScreenY', this.enemy.y - cam.scrollY);

    this.parallaxSystem.update(cam, this.player.y);
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
    // UIScene not ready yet — no input this frame.
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

  private createGroundVisual(): void {
    const { world } = gameConfig;
    const groundY = world.height - 80;

    this.add.tileSprite(0, groundY, world.width, 200, 'ground')
      .setOrigin(0, 0)
      .setDepth(-50);
  }

  private triggerGameOver(outcome: 'VICTORY' | 'DEFEAT'): void {
    if (this.isGameOver) return;
    this.isGameOver = true;

    this.time.delayedCall(300, () => {
      this.scene.pause();
      gameEvents.emit(EVENTS.GAME_OVER, { outcome });
    });
  }

  private handleRestart(): void {
    this.isGameOver = false;
    this.scene.stop('UIScene');
    this.scene.restart();
  }
}
