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
