# Types & Configuration

## TypeScript Interfaces (`src/types/game.types.ts`)

### `PlaneConfig`

Shared by player and enemy planes. Loaded from JSON and passed to the `Plane` base constructor.

| Field | Type | Description |
|---|---|---|
| `sprite` | string | Texture key |
| `width` | number | Sprite width (px) |
| `maxSpeed` | number | Constant forward speed (px/s) |
| `turnSpeed` | number | Max turn rate (degrees/s) |
| `mass` | number | Turn inertia — higher = heavier/smoother, slower to change heading |
| `health` | number | Starting and max HP |
| `damage` | number | Damage per bullet |
| `fireRate` | number | Shots per second |
| `bombCooldown` | number? | Optional. Bomb re-arm time in ms (player only; default 10000) |

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
| `bomb` | `BombConfig` |
| `camera` | `{ lerp, zoom }` |
| `parallax` | `ParallaxLayerConfig[]` |
| `spawn` | `SpawnConfig` |

### Level Interfaces

Data model for configurable levels (see [levels.md](levels.md)):

| Interface | Fields |
|---|---|
| `StageEnemyGroup` | `type` (enemy-behavior id), `count` |
| `StageConfig` | `maxConcurrent`, `enemies: StageEnemyGroup[]` |
| `LevelConfig` | `id`, `name`, `background`, `backgroundVariant`, `stages: StageConfig[]` |

### Other Interfaces

| Interface | Fields | Used by |
|---|---|---|
| `PhysicsConfig` | `turnResponsiveness` | `Plane` (mass-based turning) |
| `BulletConfig` | `speed`, `width`, `height` | `PreloadScene`, `GameScene` |
| `BombConfig` | `sprite`, `displayWidth`, `mass`, `damage`, `area`, `gravity`, `inertia` | `PreloadScene`, `BattlefieldScene`, `Bomb` |
| `ParallaxLayerConfig` | `key`, `depth`, `parallaxFactor` | `ParallaxSystem` |
| `SpawnConfig` | `ringMargin`, `ringJitter`, `minCeilingMargin`, `minGroundMargin`, `startDelayMs` | `LevelManager` |

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

### `bomb.json`

Player bomb tuning surfaced as `gameConfig.bomb` (`BombConfig`):

| Field | Meaning |
|---|---|
| `sprite` | Texture key (`bomb`) |
| `displayWidth` | On-screen width in px (height keeps aspect) |
| `mass` | Multiplies `gravity` — higher = falls faster |
| `damage` | Damage dealt to every target caught in the blast |
| `area` | Blast radius in px, measured each side of the impact point |
| `gravity` | Base downward acceleration (px/s²) before the `mass` multiplier |
| `inertia` | Fraction of the plane's forward speed kept as horizontal launch velocity |

### `spawn.json`

Off-screen-ring spawn tuning surfaced as `gameConfig.spawn` (`SpawnConfig`).
`startDelayMs` is the enemy-free grace period at the start of each level.

### `enemies/fighter.json` + `enemies/index.ts`

`fighter.json` is the only enemy archetype currently; its shape matches
`EnemyBehaviorConfig`. `enemies/index.ts` is the registry: `ENEMY_BEHAVIORS`
(id → config) plus `getEnemyBehavior(id)` (throws on an unknown id). Stages
reference enemies by this id. To add a new type, drop in a JSON file and register
it here.

### `levels/*.json` + `levels/index.ts`

Bundled level definitions matching `LevelConfig`, with `levels/index.ts` exposing
the ordered `LEVELS` array, `getLevels()`, and `getLevelById(id)`. See
[levels.md](levels.md).

---

## `gameConfig` Object

`src/game/config/gameConfig.ts` loads and merges the individual JSON files
(`world`, `physics`, `player`, `bullet`, `bomb`, `spawn`) into a single `GameConfigData`
object exported as `gameConfig`. All systems import from this single point.

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
| `backgroundLayerPaths` | `(set, variant) → { bg, fg, ground }` | Derive the three layer image paths for a background |
| `backgroundLayerKeys` | `(set, variant) → { bg, fg, ground }` | Derive the level-namespaced texture keys |

`healthColour` thresholds: green above 60%, yellow above 30%, red at or below 30%.

## Level Progress (`src/game/utils/progress.ts`)

`localStorage`-backed completion tracking (key `mr_completed_levels`), guarded
with try/catch and an in-memory fallback: `getCompleted()`, `isCompleted(id)`,
`markCompleted(id)`.
