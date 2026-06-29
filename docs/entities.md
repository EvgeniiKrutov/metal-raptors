# Entities

## Plane (abstract base)

`src/game/entities/Plane.ts` — extends `Phaser.Physics.Arcade.Sprite`.

All planes share:

| Property | Type | Description |
|---|---|---|
| `planeConfig` | `PlaneConfig` | Loaded from JSON; flight and combat stats |
| `currentSpeed` | number | Constant forward speed (px/s); fixed to `maxSpeed` at spawn |
| `angularVelocity` | number | Current turn rate (rad/s); smoothed by mass (see [physics.md](physics.md#mass-based-turning)) |
| `currentHealth` | number | Current HP |
| `maxHealth` | number | Max HP (equal to `config.health` at spawn) |

Arcade gravity is disabled on every plane body — planes never fall, they only fly forward along their heading. World bounds collision is also disabled (planes screen-wrap or are removed via other logic).

### Methods

| Method | Returns | Description |
|---|---|---|
| `applyTurnRate(desiredRate, dt)` | `void` | Eases `angularVelocity` toward `desiredRate` (mass-based) and advances `rotation` |
| `steerToHeading(targetHeading, dt)` | `void` | Turns toward a heading at up to `turnSpeed`, with mass-based lag |
| `takeDamage(amount)` | `boolean` | Subtracts HP; returns `true` when HP reaches 0 |
| `getHealthPercent()` | `number` | `currentHealth / maxHealth` (0–1) |
| `isAlive()` | `boolean` | `currentHealth > 0` |

### Damage smoke

Every plane gets a hand-drawn smoke trail (`smokeEmitter`) that activates once health drops to or below `SMOKE_HEALTH_THRESHOLD`. `updateSmoke()` must be called once per frame; it scales emission frequency (55ms → 18ms) and tint (`0x666666` → `0x222222`) as health approaches 0.

The `smoke.png` texture is ~454x375px, hence the small `scale` (0.1–0.5) on the emitter config.

`setFrequency()`/`setParticleTint()` reset the emitter's internal flow counter on every call, so `updateSmoke()` caches the last-applied `smokeFrequency`/`smokeTint` and only re-applies them when the value actually changes — calling `setFrequency()` every frame would otherwise perpetually restart the flow countdown and no particle would ever emit.

### Gun traces

Both player and enemy planes call `spawnGunTrace()` at the moment they fire (right after emitting the `'fire'` event), so the muzzle flash appears at the same point the bullet is created.

Each call spawns a fresh `Phaser.GameObjects.Sprite` using a random texture (`machine_gun_trace_1`…`machine_gun_trace_6`, preloaded by `PreloadScene` from `effects/machine_gun_traces/`). The sprite is scaled relative to the plane (`GUN_TRACE_LENGTH_FACTOR = 0.7` of `displayWidth`) so it is always smaller than the plane, and uses origin `(0, 0.5)` so it starts at the muzzle and extends forward along the plane's heading.

The trace is tied to the plane: a fade-out tween (`GUN_TRACE_LIFETIME = 90ms`) repositions it to the current muzzle each frame via `onUpdate`, then destroys it on completion. `hideWreck()` and `destroy()` kill any in-flight tweens and clear remaining traces so nothing is left floating when a plane dies or the scene shuts down.

---

## PlayerPlane

`src/game/entities/PlayerPlane.ts` — extends `Plane`.

Responds to keyboard input each frame. Emits a `'fire'` event (`x, y, angle`) when shooting so `GameScene` can spawn a bullet without the entity needing a reference to the bullet pool.

### Input Handling (`handleInput`)

`handleInput` accepts an abstract `ControlState`. The plane always flies forward
at `maxSpeed`; input only steers the heading via the mass-based turning model (see
[physics.md](physics.md#mass-based-turning)). There is no throttle or brake.

**Keyboard:**

| Key | Action |
|---|---|
| `A` / `D` | Turn left / right — drives the desired turn rate to `∓turnSpeed`; releasing lets the heading coast to a stop via inertia |
| `F` | Fire (respects `fireRate` cooldown) |
| `H` | Drop a bomb (respects `bombCooldown`, default 10s) |

Pressing `H` emits a `'bomb'` event (`x, y, angle, speed`) once the bomb cooldown
has elapsed. The drop point is horizontally aligned with the plane and offset just
below its fuselage (`y + displayHeight * 0.5`); `angle` and `speed` are the plane's
heading and forward speed so the bomb inherits the plane's momentum. The cooldown
length comes from `planeConfig.bombCooldown`; `getBombCooldownRatio()` exposes the
remaining fraction (1 → just dropped, 0 → ready) for the HUD. The bomb feature is
only wired up in `BattlefieldScene`.

**Touch joystick:**

When the stick is pushed past the dead-zone it supplies a `targetHeading`
(the direction the finger points). The plane calls `steerToHeading(targetHeading)`,
so it **follows the finger with a slight delay** set by its `mass`. Releasing the
stick drops `targetHeading`, and the heading coasts to a stop via inertia
(see [scenes.md](scenes.md#joystick--touch-controls)).

---

## EnemyPlane

`src/game/entities/EnemyPlane.ts` — extends `Plane`.

Driven by the AI state machine each frame via `updateAI(delta, ctx)`. Also emits `'fire'` events (same signature as `PlayerPlane`) for bullet spawning in `GameScene`.

Initialises facing left (`rotation = Math.PI`) toward the player's start position.

See [enemy-ai.md](enemy-ai.md) for the full AI documentation.

---

## Bullet

`src/game/entities/Bullet.ts` — extends `Phaser.Physics.Arcade.Image`.

Uses **object pooling**: bullets are never destroyed; they are deactivated and returned to the `Phaser.Physics.Arcade.Group` pool to be recycled by the next `group.get()` call.

| Property | Description |
|---|---|
| `damage` | Damage applied on hit; set at fire time |

### Methods

| Method | Description |
|---|---|
| `fire(x, y, angle, speed, damage)` | Activates the bullet, sets position/velocity/damage |
| `deactivate()` | Returns bullet to pool (sets active+visible false, zeroes velocity) |

Bullet velocity is computed from angle:
```
vx = cos(angle) × speed
vy = sin(angle) × speed
```

Arcade gravity is disabled on bullets.

---

## Bomb

`src/game/entities/Bomb.ts` — extends `Phaser.Physics.Arcade.Image`.

A gravity-driven projectile dropped by the player in `BattlefieldScene`. Unlike
bullets, bombs are **not pooled** — each is created on drop and `destroy()`ed when
it hits the ground or leaves the world. The texture is `bomb`
(`effects/missiles_world_war_1/missile_2.png`).

| Property | Description |
|---|---|
| `damage` | Damage applied to every target in the blast (from `BombConfig`) |
| `area` | Blast radius in px, measured each side of impact (from `BombConfig`) |

### Methods

| Method | Description |
|---|---|
| `drop(angle, planeSpeed)` | Sets the initial velocity to `planeSpeed × inertia` along `angle` (so the bomb keeps the plane's momentum) and enables a downward gravity of `gravity × mass`. Heavier bombs fall faster. |
| `faceVelocity()` | Rotates the sprite to point along its current velocity, so it noses down as it falls (called each frame by the scene) |

The combination of forward inertia and downward gravity produces a parabolic
arc rather than a straight vertical drop. On reaching the ground the scene plays
a ground explosion (`explosion` spritesheet, same as a crashed plane) and applies
`damage` to every enemy **vehicle** within `area` px horizontally, plus any low
enemy **plane** within `area` px both horizontally and above the impact point. The
player's own plane is never affected. See [battlefield.md](battlefield.md#bombing).
