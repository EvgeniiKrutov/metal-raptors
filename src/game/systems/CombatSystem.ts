import Phaser from 'phaser';
import { Bullet } from '../entities/Bullet';
import { EnemyPlane } from '../entities/EnemyPlane';
import { PlayerPlane } from '../entities/PlayerPlane';

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

  checkBulletEnemiesCollision(
    bullets: Phaser.Physics.Arcade.Group,
    enemies: EnemyPlane[],
  ): EnemyHit[] {
    const hits: EnemyHit[] = [];

    for (const enemy of enemies) {
      if (!enemy.isAlive()) continue;

      let hit = false;
      let killed = false;

      this.scene.physics.overlap(
        enemy,
        bullets,
        (obj1, obj2) => {
          const bullet = obj2 as Bullet;
          if (!bullet.active) return;

          const isDead = enemy.takeDamage(bullet.damage);
          bullet.deactivate();
          hit = true;
          if (isDead) killed = true;

          this.flashHit(enemy, isDead);
        },
        undefined,
        this,
      );

      if (hit) hits.push({ enemy, killed });
    }

    return hits;
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

  private flashHit(target: EnemyPlane | PlayerPlane, dead: boolean): void {
    if (dead) return;
    target.setTint(0xff0000);
    this.scene.time.delayedCall(this.hitFlashDuration, () => {
      if (target.active) target.clearTint();
    });
  }
}
