# Systems

## CombatSystem

`src/game/systems/CombatSystem.ts`

Handles all collision detection and damage application between bullets and planes.

### Methods

#### `checkBulletEnemiesCollision(bullets, enemies) → EnemyHit[]`

Loops over the live enemy list and uses `physics.overlap` to test every active
player bullet against each enemy sprite. On each hit:
1. `enemy.takeDamage(bullet.damage)` is called
2. The bullet is deactivated (returned to pool)
3. A red-tint flash is applied for `hitFlashDuration` ms (80 ms)

Returns one `{ enemy, killed }` entry per enemy hit this frame. The caller
(`GameScene`) uses this to fire `onDamaged` on survivors, and to explode + remove
any enemy whose `killed` flag is set. Dead enemies are skipped.

#### `checkEnemyBulletPlayerCollision(enemyBullets, player) → boolean`

Tests enemy bullets against the player. Returns `true` on any hit, `false` if the
player is already dead.

### Hit Flash

A 80 ms red tint (`0xff0000`) is applied via `setTint`. After the delay the tint is cleared only if the target is still active (i.e. not destroyed between the hit and the callback).

---

## LevelManager

`src/game/systems/LevelManager.ts`

Owns level progress and enemy spawning. Constructed by `GameScene` after the
player exists:

```ts
new LevelManager(scene, level, player, interpolationSystem, {
  onStageChanged: (stageIndex, totalStages) => { /* update HUD registry */ },
  onLevelCompleted: () => this.triggerVictory(),
});
levelManager.start();
```

### State

- active `LevelConfig`, current `stageIndex`, and a `completed` flag
- `spawnQueue: string[]` — the current stage's quota flattened to a list of
  enemy-behavior ids (built by `buildQueueForCurrentStage`)
- `activeEnemies: EnemyPlane[]` — enemies currently alive on screen

### `update(delta)`

0. **Start delay** — accumulate `delta` into `elapsedMs`; while it is below
   `spawn.startDelayMs`, return early so the player flies enemy-free for the
   first few seconds of the level. `elapsedMs` resets in `start()`.
1. **Prune** — drop any non-alive enemies from `activeEnemies` and unregister
   them from the `InterpolationSystem` (safety net; `GameScene` removes killed
   enemies explicitly via `removeEnemy`).
2. **Spawn** — while `activeEnemies.length < stage.maxConcurrent` and the queue
   is non-empty, pop the next id and spawn it (off-screen ring placement).
3. **Stage clear** — while `queue empty && active empty`: if more stages remain,
   advance `stageIndex`, rebuild the queue, fire `onStageChanged`, and spawn;
   otherwise set `completed` and fire `onLevelCompleted`. The loop resolves any
   run of empty stages in a single frame without hanging.

### Spawn placement

`computeSpawnPoint()` picks a random angle around the player and a radius of
`max(view.width, view.height)/2 + spawn.ringMargin + random(0, spawn.ringJitter)`,
then clamps Y between `ceiling + minCeilingMargin` and `groundY − minGroundMargin`.
The radius keeps the ring outside the camera, but the Y clamp can pull a near-top
or near-bottom point back into view (e.g. when the player hugs the ceiling or
ground); when the clamped point lands inside `camera.worldView`, X is pushed past
the nearer view edge (`view.left`/`view.right`, on the side the angle pointed) by
`ringMargin + random(0, ringJitter)`, so enemies always appear off-screen. X is
finally normalised with the world horizontal wrap. Each spawned `EnemyPlane` is
rotated to face the player, registered with the `InterpolationSystem`, and has
its `'fire'` event wired to `GameScene.spawnEnemyBullet`.

### Accessors

`getActiveEnemies()`, `getStageIndex()`, `getTotalStages()`,
`getRemainingCount()` (queued + alive), and `removeEnemy(enemy)` (unregister +
splice). See [levels.md](levels.md) for the level data model.

---

## PhysicsSystem

`src/game/systems/PhysicsSystem.ts`

Stateless utility — all logic lives in the static method `updateFlight(plane, delta, isThrottlingUp)`.

See [physics.md](physics.md) for a full description of the force model.

---

## InterpolationSystem

`src/game/systems/InterpolationSystem.ts`

Decouples rendering from simulation so fast sprites stay smooth on high-refresh / variable-refresh (ProMotion, 120 Hz) displays, without `forceSetTimeOut`.

### Why

Arcade Physics already advances bodies on a **fixed timestep** (`physics.arcade.fixedStep: true`, `fps` in the Phaser config). The simulation is therefore deterministic and frame-rate independent. What Arcade does *not* do is interpolate the rendered sprite between those fixed steps — it copies the body position onto `sprite.x/y` once per render frame. On a panel whose render frames land at irregular real-world intervals, the sprite is drawn at uneven on-screen positions and fast motion smears under smooth-pursuit eye tracking. This system fills that gap.

### How

Only **position** is interpolated. Rotation, screen-wrap and the ceiling clamp are written straight onto the sprite each frame inside `GameScene.update` (they are not part of Arcade's fixed-step body integration), so the system leaves `sprite.rotation` untouched — turning stays instant and identical to before. The ProMotion blur comes from uneven *translation*, which is exactly what gets interpolated.

For every registered sprite the system tracks the previous and current authoritative (body-driven) positions, then drives three scene/physics hooks:

| Hook | Phase | Action |
|---|---|---|
| `worldstep` | a fixed physics step just ran | flags that a step happened this frame |
| `postupdate` | after physics sync, before render | snapshot (`prev ← cur`, `cur ← sprite.{x,y}`) on stepped frames, then draw at `lerp(prev, cur, alpha)` |
| `preupdate` | next frame, before `update` + physics | restore sprite to authoritative `cur` position |

`alpha = clamp(world._elapsed / world._frameTimeMS, 0, 1)` is Arcade's leftover-accumulator fraction — always in `[0, 1)`, so this is pure interpolation, never extrapolation. The snapshot reads the sprite during `postupdate` because Arcade only syncs the body position back onto the sprite there (not at `worldstep`); on frames with zero physics steps (common at high refresh rates) the snapshot is skipped and `alpha` sweeps `prev → cur`.

### Hitboxes are unchanged

The **physics body is never moved by this system.** The sprite is restored to its authoritative position in `preupdate` — before `GameScene.update` reads any positions and before the next physics step — so every body integration and every `physics.overlap` test runs at the exact same position and size as before interpolation existed. Only the *drawn* position is shifted, and only during the post-update → next-pre-update window.

### Teleports and pooling

A jump larger than the teleport threshold (256 px between steps — world-wrap, spawn, reset) snaps instead of interpolating, so the sprite never streaks across the screen. Pooled objects (bullets) are registered once on spawn; reactivation from the pool also snaps. Camera follow targets the (interpolated) sprite, so background scroll is smooth too.

### Usage

```ts
this.interpolationSystem = new InterpolationSystem(this);
this.interpolationSystem.register(this.player);
this.interpolationSystem.register(this.enemy);
// on bullet spawn:
this.interpolationSystem.register(bullet);
```

Listeners are torn down automatically on scene `shutdown` / `destroy`.

---

## ParallaxSystem

`src/game/systems/ParallaxSystem.ts`

Manages two full-screen background layers that create a sense of altitude.

### Layers

`create(bgKey, fgKey)` takes the background and foreground texture keys as
parameters (the level-namespaced keys built by `backgroundLayerKeys`), so each
level supplies its own artwork rather than the layers being hardcoded.

| Layer | Texture | Depth | Scroll |
|---|---|---|---|
| background | `bgKey` (sky) | -100 | Screen-fixed (pinned to the camera view) |
| foreground | `fgKey` (ground) | -90 | Screen-fixed (pinned to the camera view) |

Both layers stay fixed on screen — they do not move as the camera scrolls
horizontally. Rather than `setScrollFactor(0)` (which is mis-scaled under the
screen-height-driven camera zoom), each layer is **anchored to the camera's
visible world rectangle** (`camera.worldView`) every frame and sized to cover it
(`layerWidth = (screenWidth / screenHeight) × 1080 + overscan`, recomputed on
`resize`). This fills any aspect ratio — desktop or phone — with no gaps. See
[display-and-responsiveness.md](display-and-responsiveness.md).

### Altitude Effect (`update`)

The foreground layer fades in and slides up as the player descends. The effect is driven by `t`, a normalised player Y position:

```
t = clamp((playerY − playerMinY) / (playerMaxY − playerMinY), 0, 1)
alpha = clamp((t + fgThreshold) / (1 + fgThreshold), 0, 1)
fg.y = view.y + lerp(1080, fgOffset, alpha)
```

- At the top of the world (`playerMinY = 20`): `alpha ≈ 0`, foreground invisible
- Near the ground (`playerMaxY = worldHeight − 80`): `alpha → 1`, foreground fully visible and slid up to `fgOffset = −30`

`fgThreshold = 0.5` means the foreground starts fading in when the player is halfway to the ground.
