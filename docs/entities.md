# Entities

## Plane (abstract base)

`src/game/entities/Plane.ts` — extends `Phaser.Physics.Arcade.Sprite`.

All planes share:

| Property | Type | Description |
|---|---|---|
| `planeConfig` | `PlaneConfig` | Loaded from JSON; flight and combat stats |
| `currentSpeed` | number | Engine speed scalar (px/s); initialised to 70% of `maxSpeed` |
| `verticalDrift` | number | Accumulated gravity–lift imbalance (px/s); positive = downward |
| `currentHealth` | number | Current HP |
| `maxHealth` | number | Max HP (equal to `config.health` at spawn) |

Arcade gravity is disabled on every plane body; gravity is applied manually by `PhysicsSystem`. World bounds collision is also disabled (planes screen-wrap or are removed via other logic).

### Methods

| Method | Returns | Description |
|---|---|---|
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

| Key | Action |
|---|---|
| `W` | Throttle up — increases `currentSpeed` by `acceleration × dt` |
| `S` | Brake — decreases `currentSpeed` by `braking × dt` |
| `A` / `D` | Rotate left / right by `turnSpeed` (deg/s) × dt |
| `F` | Fire (respects `fireRate` cooldown) |

When no throttle key is held, natural drag is applied: `currentSpeed -= currentSpeed × dragCoefficient`.

`isThrottlingUp` is tracked and forwarded to `PhysicsSystem` so the stall model knows whether the player is trying to recover.

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
