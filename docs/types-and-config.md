# Types & Configuration

## TypeScript Interfaces (`src/types/game.types.ts`)

### `PlaneConfig`

Shared by player and enemy planes. Loaded from JSON and passed to the `Plane` base constructor.

| Field | Type | Description |
|---|---|---|
| `sprite` | string | Texture key |
| `width` | number | Sprite width (px) |
| `maxSpeed` | number | Maximum speed (px/s) |
| `minSpeed` | number | Minimum speed — AI lower bound (px/s) |
| `acceleration` | number | Speed increase per second (px/s²) |
| `braking` | number | Speed decrease per second (px/s²) |
| `turnSpeed` | number | Max rotation rate (degrees/s) |
| `weight` | number | Gravity multiplier in physics model |
| `health` | number | Starting and max HP |
| `damage` | number | Damage per bullet |
| `fireRate` | number | Shots per second |

### `EnemyBehaviorConfig`

Data-driven definition for one enemy archetype. A single JSON file fully describes the type — no TypeScript changes needed to add a new enemy. See [enemy-ai.md](enemy-ai.md) for field-level documentation of the `ai` sub-object.

Top-level fields:

| Field | Description |
|---|---|
| `id` | Machine-readable archetype id, e.g. `"fighter"` |
| `name` | Display name, e.g. `"WW1 Fighter"` |
| `stats` | Combat stats: `sprite`, `width`, `health`, `damage`, `fireRate` |
| `flight` | Flight envelope fed into `PhysicsSystem` |
| `ai` | AI behaviour tuning (targeting, ground avoidance, state timers, evasion) |

### `GameConfigData`

Root shape of the merged game configuration object (`gameConfig`).

| Field | Type |
|---|---|
| `display` | `{ width, height }` — canvas/screen size |
| `world` | `{ width, height }` — scrollable world size |
| `physics` | `PhysicsConfig` |
| `player` | `PlaneConfig` |
| `enemy` | `PlaneConfig` |
| `bullet` | `BulletConfig` |
| `camera` | `{ lerp, zoom }` |
| `parallax` | `ParallaxLayerConfig[]` |

### Other Interfaces

| Interface | Fields | Used by |
|---|---|---|
| `PhysicsConfig` | `gravity`, `dragCoefficient`, `liftCoefficient`, `stallSpeed`, `stallRotationRate` | `PhysicsSystem` |
| `BulletConfig` | `speed`, `width`, `height` | `PreloadScene`, `GameScene` |
| `ParallaxLayerConfig` | `key`, `depth`, `parallaxFactor` | `ParallaxSystem` |

### Types

| Type | Values |
|---|---|
| `GameState` | `'INIT' \| 'LOADING' \| 'PLAYING' \| 'GAME_OVER'` |
| `GameOutcome` | `'VICTORY' \| 'DEFEAT' \| null` |

---

## Configuration Files

All JSON config lives under `src/game/config/data/`.

### `world.json`

World and display dimensions, camera lerp/zoom.

### `physics.json`

Global flight physics constants. See [physics.md](physics.md).

### `player.json`

Player plane stats as a `PlaneConfig`.

### `bullet.json`

Bullet speed, width, height.

### `enemies/fighter.json`

Fighter archetype — the only enemy type currently. Shape matches `EnemyBehaviorConfig`. To add a new enemy type, create a new JSON file with the same shape and pass it to `EnemyPlane`.

---

## `gameConfig` Object

`src/game/config/gameConfig.ts` loads and merges the individual JSON files into a single `GameConfigData` object exported as `gameConfig`. All systems import from this single point.

---

## Utility Functions (`src/game/utils/helpers.ts`)

| Function | Signature | Description |
|---|---|---|
| `clamp` | `(value, min, max) → number` | Clamp a value between min and max |
| `wrapX` | `(x, width) → number` | Wrap x within `[0, width]` |
| `degToRad` | `(deg) → number` | Degrees to radians (delegates to Phaser) |
| `lerp` | `(a, b, t) → number` | Linear interpolation |
| `mapRange` | `(value, inMin, inMax, outMin, outMax) → number` | Map a value from one range to another |
| `healthColour` | `(percent) → number` | Returns green / yellow / red colour based on HP% |

`healthColour` thresholds: green above 60%, yellow above 30%, red at or below 30%.
