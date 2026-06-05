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
