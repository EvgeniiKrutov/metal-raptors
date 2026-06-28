import Phaser from 'phaser';
import { Bullet } from '../entities/Bullet';
import { EnemyPlane } from '../entities/EnemyPlane';
import { PlayerPlane } from '../entities/PlayerPlane';

export interface Damageable extends Phaser.GameObjects.GameObject {
  x: number;
  y: number;
  takeDamage(amount: number): boolean;
  isAlive(): boolean;
  setTint(color?: number): this;
  clearTint(): this;
}

export interface TargetHit {
  target: Damageable;
  killed: boolean;
}

export interface EnemyHit {
  enemy: EnemyPlane;
  killed: boolean;
}

export class CombatSystem {
  private scene: Phaser.Scene;
  private hitFlashDuration: number = 80;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  checkBulletTargetsCollision(
    bullets: Phaser.Physics.Arcade.Group,
    targets: Damageable[],
  ): TargetHit[] {
    const hits: TargetHit[] = [];

    for (const target of targets) {
      if (!target.isAlive()) continue;

      let hit = false;
      let killed = false;

      this.scene.physics.overlap(
        target,
        bullets,
        (obj1, obj2) => {
          const bullet = obj2 as Bullet;
          if (!bullet.active) return;

          const isDead = target.takeDamage(bullet.damage);
          bullet.deactivate();
          hit = true;
          if (isDead) killed = true;

          this.flashHit(target, isDead);
        },
        undefined,
        this,
      );

      if (hit) hits.push({ target, killed });
    }

    return hits;
  }

  checkBulletEnemiesCollision(
    bullets: Phaser.Physics.Arcade.Group,
    enemies: EnemyPlane[],
  ): EnemyHit[] {
    return this.checkBulletTargetsCollision(bullets, enemies).map((hit) => ({
      enemy: hit.target as EnemyPlane,
      killed: hit.killed,
    }));
  }

  checkEnemyBulletPlayerCollision(
    enemyBullets: Phaser.Physics.Arcade.Group,
    player: PlayerPlane,
  ): boolean {
    if (!player.isAlive()) return false;

    let hit = false;

    this.scene.physics.overlap(
      player,
      enemyBullets,
      (obj1, obj2) => {
        const bullet = obj2 as Bullet;
        if (!bullet.active) return;

        const isDead = player.takeDamage(bullet.damage);
        bullet.deactivate();
        hit = true;

        this.flashHit(player, isDead);
      },
      undefined,
      this,
    );

    return hit;
  }

  private flashHit(target: Damageable, dead: boolean): void {
    if (dead) return;
    target.setTint(0xff0000);
    this.scene.time.delayedCall(this.hitFlashDuration, () => {
      if (target.active) target.clearTint();
    });
  }
}
