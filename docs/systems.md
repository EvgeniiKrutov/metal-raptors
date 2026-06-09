# Systems

## CombatSystem

`src/game/systems/CombatSystem.ts`

Handles all collision detection and damage application between bullets and planes.

### Methods

#### `checkBulletEnemyCollision(bullets, enemy) → boolean`

Uses `physics.overlap` to test every active player bullet against the enemy sprite. On each hit:
1. `enemy.takeDamage(bullet.damage)` is called
2. The bullet is deactivated (returned to pool)
3. A red-tint flash is applied for `hitFlashDuration` ms (80 ms)

Returns `true` if at least one bullet connected this frame. The caller (`GameScene`) uses this to update the registry, emit health events, and check for enemy death.

#### `checkEnemyBulletPlayerCollision(enemyBullets, player) → boolean`

Same as above but tests enemy bullets against the player. Returns `true` on any hit.

Both methods return early (`false`) if the target is already dead.

### Hit Flash

A 80 ms red tint (`0xff0000`) is applied via `setTint`. After the delay the tint is cleared only if the target is still active (i.e. not destroyed between the hit and the callback).

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

| Layer | Texture | Depth | Scroll |
|---|---|---|---|
| `bg` | sky background | -100 | Fixed (scroll factor 0) |
| `fg` | ground foreground | -90 | Fixed (scroll factor 0) |

Both layers are fixed to the screen (`setScrollFactor(0)`) — they do not move as the camera scrolls horizontally.

### Altitude Effect (`update`)

The foreground layer fades in and slides up as the player descends. The effect is driven by `t`, a normalised player Y position:

```
t = clamp((playerY − playerMinY) / (playerMaxY − playerMinY), 0, 1)
alpha = clamp((t + fgThreshold) / (1 + fgThreshold), 0, 1)
fg.alpha = alpha
fg.y = lerp(display.height, fgOffset, alpha)
```

- At the top of the world (`playerMinY = 20`): `alpha ≈ 0`, foreground invisible
- Near the ground (`playerMaxY = worldHeight − 80`): `alpha → 1`, foreground fully visible and slid up to `fgOffset = −80`

`fgThreshold = 0.5` means the foreground starts fading in when the player is halfway to the ground.
