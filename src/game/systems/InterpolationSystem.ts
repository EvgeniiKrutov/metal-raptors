import Phaser from 'phaser';

interface InterpEntry {
  obj: Phaser.GameObjects.Components.Transform &
       Phaser.GameObjects.GameObject & { active: boolean };

  prevX: number;
  prevY: number;

  curX: number;
  curY: number;

  primed: boolean;
  wasActive: boolean;
}

export class InterpolationSystem {
  private scene: Phaser.Scene;
  private world: Phaser.Physics.Arcade.World;
  private entries: InterpEntry[] = [];
  private steppedThisFrame: boolean = false;

  private readonly teleportThresholdSq: number;

  constructor(scene: Phaser.Scene, teleportThreshold: number = 256) {
    this.scene = scene;
    this.world = scene.physics.world;
    this.teleportThresholdSq = teleportThreshold * teleportThreshold;

    this.world.on('worldstep', this.onWorldStep, this);
    this.scene.events.on('preupdate', this.onPreUpdate, this);
    this.scene.events.on('postupdate', this.onPostUpdate, this);

    this.scene.events.once('shutdown', this.destroy, this);
    this.scene.events.once('destroy', this.destroy, this);
  }

  register(
    obj: Phaser.GameObjects.Components.Transform &
         Phaser.GameObjects.GameObject & { active: boolean },
  ): void {
    if (this.entries.some((e) => e.obj === obj)) return;

    this.entries.push({
      obj,
      prevX: obj.x,
      prevY: obj.y,
      curX: obj.x,
      curY: obj.y,
      primed: false,
      wasActive: obj.active,
    });
  }

  unregister(obj: Phaser.GameObjects.GameObject): void {
    const i = this.entries.findIndex((e) => e.obj === obj);
    if (i !== -1) this.entries.splice(i, 1);
  }

  private onWorldStep(): void {
    this.steppedThisFrame = true;
  }

  private onPreUpdate(): void {
    for (const e of this.entries) {
      if (!e.primed || !e.obj.active) continue;
      e.obj.x = e.curX;
      e.obj.y = e.curY;
    }
  }

  private onPostUpdate(): void {
    const world = this.world as unknown as {
      _elapsed: number;
      _frameTimeMS: number;
    };
    const stepped = this.steppedThisFrame;
    this.steppedThisFrame = false;
    const alpha = Phaser.Math.Clamp(world._elapsed / world._frameTimeMS, 0, 1);

    for (const e of this.entries) {
      const obj = e.obj;

      if (!obj.active) {
        e.prevX = e.curX = obj.x;
        e.prevY = e.curY = obj.y;
        e.primed = true;
        e.wasActive = false;
        continue;
      }

      if (stepped) {
        this.snapshot(e, obj.x, obj.y);
      }

      if (!e.primed) continue;

      obj.x = Phaser.Math.Linear(e.prevX, e.curX, alpha);
      obj.y = Phaser.Math.Linear(e.prevY, e.curY, alpha);
    }
  }

  private snapshot(e: InterpEntry, newX: number, newY: number): void {
    const justActivated = !e.wasActive;
    e.wasActive = true;

    if (e.primed && !justActivated) {
      const dx = newX - e.curX;
      const dy = newY - e.curY;
      const teleported = dx * dx + dy * dy > this.teleportThresholdSq;

      if (teleported) {
        e.prevX = newX;
        e.prevY = newY;
      } else {
        e.prevX = e.curX;
        e.prevY = e.curY;
      }
    } else {
      e.prevX = newX;
      e.prevY = newY;
      e.primed = true;
    }

    e.curX = newX;
    e.curY = newY;
  }

  destroy(): void {
    this.world.off('worldstep', this.onWorldStep, this);
    this.scene.events.off('preupdate', this.onPreUpdate, this);
    this.scene.events.off('postupdate', this.onPostUpdate, this);
    this.entries.length = 0;
  }
}
