# Battlefield Section & Level — Implementation Spec

> Feature spec for introducing a second gameplay **section** ("Battlefield")
> alongside the existing levels (now grouped under "Air Fights"), and a brand-new
> **side-scrolling battlefield level** where the player fights enemy planes *and*
> destroys ground vehicles driving across a curved terrain.
>
> Status: Ready for implementation · Target codebase: `metal-raptors` (React + Phaser 3)
> Companion to [.ai/levels-spec.md](levels-spec.md).

---

## 1. Goal

The current game has a single flat list of levels, all played in `GameScene`
(top-down-ish vertical parallax dogfight). This feature:

1. **Re-groups the menu into sections.** The two existing levels move under an
   **"Air Fights"** section. A new **"Battlefield"** section is added.
2. **Adds a new battlefield level** with a completely different presentation:
   - **No parallax.** A side-scrolling map (`backgrounds/battlefield/level_map.png`)
     with a **curved ground**.
   - The player flies a plane (same steering feel as the air levels) inside a
     **camera window centred on the plane**; the world scrolls and the plane
     **wraps horizontally** like the air levels.
   - Combat is against **enemy planes** (reusing the existing flight AI) **and
     ground vehicles** that drive along the terrain.
   - The first ground vehicle is the **`ernhardt_truck`**: it spawns off the
     right edge, drives **slowly right → left** following the ground curve, takes
     damage, **explodes on the ground** when killed, and is **removed** from
     memory/map when it is destroyed or leaves the play area.
3. **Keeps air and battlefield config fully separate** where it matters — the
   battlefield has its own scene, level files, world/zoom config, and machine
   (vehicle) config. The flying enemy planes **reuse** the existing `fighter`
   archetype (it is the same plane behaviour).

---

## 2. Decisions (locked)

Confirmed up-front; these drive the design below.

| Topic | Decision |
|---|---|
| **Ground collision model** | **Configurable curve points in the level JSON.** An array of `{ x, y }` control points authored over one map-tile width, interpolated into a `groundYAt(x)` function. Used for plane-crash, bullet-impact, and truck driving height. No image scanning, no Matter.js. |
| **Win / lose** | **Stage quota, exactly like the air levels.** The level JSON lists stages whose enemy quota mixes planes and trucks; clearing the last stage = **VICTORY**. Plane touching the ground curve, or player health 0 = **DEFEAT**. |
| **World extent / scrolling** | **Endless — wrap like the air levels.** The map image tiles horizontally across a finite world width; the plane wraps left↔right at the world edges. The ground curve is **periodic** (repeats every map-tile width). |
| **Threats to the player** | **Enemy planes (reuse air AI) + crashing into the ground.** Trucks are **passive** — they only drive and can be destroyed; they do **not** fire at the player (for now). |
| **Menu presentation** | **Two-step.** The start screen first lists the **sections**; tapping a section opens that section's level list (with a Back button, mirroring the existing Garage flow). |
| **Config separation** | **Battlefield gets its own scene, level files, world/zoom config, and machine config.** The **flying enemy planes reuse the shared `fighter` archetype**; the player uses the shared selected-plane config (sized via the battlefield camera zoom). |

### Tunable defaults (configurable, set sensible values, easy to change later)

| Tunable | Default | Notes |
|---|---|---|
| Map tile size | `1293 × 1024` | Actual `level_map.png` dimensions. |
| World width | `tileWidth × 3` (`3879`) | Wrap world; must be an integer multiple of `tileWidth` so the seam aligns. |
| Camera zoom | `1.0` | Sizes the plane/map "enough for playing"; tune after first run. |
| Ceiling (min plane Y) | `40` | Same idea as the air ceiling. |
| Truck display width | `~200 px` | "Comparable to the bases in the image"; tune to taste. |
| Truck health | `60` | |
| Truck speed | `40 px/s` | "Drives slowly." |

---

## 3. Architecture overview

Reuse as much as possible; isolate what is genuinely different.

**Reused as-is:** `PlayerPlane`, `EnemyPlane` + its AI, `Bullet` (pooled),
`InterpolationSystem`, `CombatSystem` (generalised slightly — see §7), `UIScene`
(HUD, joystick, pause button), the React shell, the `gameEvents`/registry bridge,
the `explosion` (ground) and `explosion_air` spritesheets, and the
`fighter` enemy archetype.

**New / battlefield-specific:**

```
GameContainer (Phaser scene list)
  BootScene → PreloadScene ─┬─ START_GAME(levelId) resolves which scene to start
                            ├─ GameScene          (air levels — unchanged)
                            └─ BattlefieldScene    (NEW)
                                   ↕ (parallel)
                               UIScene (shared)
```

- `PreloadScene` no longer hard-codes `scene.start('GameScene', …)`. It resolves
  the level id → its **scene key** via a registry and starts the right scene.
- `BattlefieldScene` replaces the `ParallaxSystem` with a `TerrainSystem`
  (background tiling + ground curve) and uses a `BattlefieldLevelManager` that
  spawns **planes** (off-screen ring, reusing the air placement) and **trucks**
  (off the right edge, driving left).

---

## 4. File changes

### New files

```
src/game/scenes/BattlefieldScene.ts          NEW scene (no parallax, curved ground, trucks)
src/game/systems/TerrainSystem.ts            Background tiling + groundYAt(x) curve + collision
src/game/systems/BattlefieldLevelManager.ts  Stage/quota spawner for planes (ring) + trucks (right edge)
src/game/entities/Machine.ts                 Ground-vehicle entity (truck): drives left, follows ground, damageable

src/game/config/data/battlefield/world.json              tile size, world width, camera/zoom, ceiling
src/game/config/data/battlefield/machines/truck.json     ernhardt_truck stats
src/game/config/data/battlefield/machines/index.ts       machine registry (getMachine)
src/game/config/data/battlefield/levels/battlefield-1.json   first battlefield level (map + ground curve + stages)
src/game/config/data/battlefield/levels/index.ts         battlefield level registry

src/game/config/data/sections.ts             Section registry: id, name, scene key, level list (air + battlefield)

docs/battlefield.md                          Feature documentation (per repo style rule: docs live in /docs)
```

### Changed files

```
src/types/game.types.ts            + BattlefieldLevelConfig, GroundCurveConfig, MachineConfig, BattlefieldWorldConfig, SectionConfig
src/game/scenes/PreloadScene.ts    Resolve scene key from level id on START_GAME; preload battlefield-shared textures (truck, map)
src/components/GameContainer.tsx    Register BattlefieldScene in the Phaser scene array
src/components/StartScreen.tsx      Two-step section → level navigation
src/hooks/useGame.ts               (likely unchanged — START_GAME already carries levelId)
src/game/systems/CombatSystem.ts    Generalise bullet→target collision to a shared Damageable interface (planes + machines)
docs/scenes.md, docs/levels.md, docs/architecture.md   Cross-reference the new scene/section/terrain
```

> **Style rule reminder:** no inline code comments; all narrative documentation
> goes into `/docs/*.md`. This spec lives under `.ai/` like the levels spec.

---

## 5. Data model & config

### 5.1 Types (`src/types/game.types.ts`)

```ts
// --- Sections (menu grouping + scene routing) ---
export interface SectionLevelRef { id: string; name: string; }
export interface SectionConfig {
  id: string;        // 'air' | 'battlefield'
  name: string;      // 'Air Fights' | 'Battlefield'
  sceneKey: string;  // 'GameScene' | 'BattlefieldScene'
  levels: SectionLevelRef[];
}

// --- Battlefield world / camera ---
export interface BattlefieldWorldConfig {
  tileWidth: number;
  tileHeight: number;
  widthTiles: number;          // world.width = tileWidth * widthTiles
  camera: { lerp: number; zoom: number };
  ceiling: number;             // min plane Y
}

// --- Ground curve ---
export interface GroundPoint { x: number; y: number; }   // x in [0, tileWidth]
export interface GroundCurveConfig { points: GroundPoint[]; }

// --- Machines (ground vehicles) ---
export interface MachineConfig {
  id: string;            // 'truck'
  name: string;          // 'Ernhardt Truck'
  sprite: string;        // texture key 'ernhardt_truck'
  displayWidth: number;  // on-screen width; height derived from aspect
  health: number;
  speed: number;         // px/s, drives left
}

// --- Battlefield level ---
export interface BattlefieldStageGroup { type: string; count: number; }  // type ∈ machines ∪ enemies
export interface BattlefieldStageConfig { maxConcurrent: number; enemies: BattlefieldStageGroup[]; }
export interface BattlefieldLevelConfig {
  id: string;            // unique; localStorage completion key (shares mr_completed_levels)
  name: string;
  section: 'battlefield';
  map: string;           // 'battlefield' → backgrounds/battlefield/level_map.png
  ground: GroundCurveConfig;
  stages: BattlefieldStageConfig[];
}
```

The existing air `LevelConfig` is untouched. The battlefield level is a distinct
type with its own registry, so the two never collide.

### 5.2 `battlefield/world.json`

```json
{
  "tileWidth": 1293,
  "tileHeight": 1024,
  "widthTiles": 3,
  "camera": { "lerp": 0.1, "zoom": 1.0 },
  "ceiling": 40
}
```

### 5.3 `battlefield/machines/truck.json`

```json
{
  "id": "truck",
  "name": "Ernhardt Truck",
  "sprite": "ernhardt_truck",
  "displayWidth": 200,
  "health": 60,
  "speed": 40
}
```

`machines/index.ts` mirrors `enemies/index.ts`:

```ts
export function getMachine(id: string): MachineConfig | undefined;
export function isMachineType(id: string): boolean;
```

### 5.4 `battlefield/levels/battlefield-1.json`

Ground `y` values are authored against the map-tile image (origin top-left, the
grass top sits around `y ≈ 690` in the `1293×1024` art). **The first and last
points must share the same `y` so the curve is seamless across the wrap seam.**

```json
{
  "id": "battlefield-1",
  "name": "Western Front",
  "section": "battlefield",
  "map": "battlefield",
  "ground": {
    "points": [
      { "x": 0,    "y": 690 },
      { "x": 320,  "y": 668 },
      { "x": 640,  "y": 700 },
      { "x": 980,  "y": 672 },
      { "x": 1293, "y": 690 }
    ]
  },
  "stages": [
    { "maxConcurrent": 3, "enemies": [ { "type": "truck", "count": 3 } ] },
    { "maxConcurrent": 3, "enemies": [ { "type": "fighter", "count": 2 }, { "type": "truck", "count": 2 } ] },
    { "maxConcurrent": 4, "enemies": [ { "type": "fighter", "count": 3 }, { "type": "truck", "count": 3 } ] }
  ]
}
```

> Note: the sample `y` values are a starting point measured from the art and will
> be fine-tuned in-engine after the first run.

### 5.5 `sections.ts` (menu registry + scene routing)

```ts
export const SECTIONS: SectionConfig[] = [
  { id: 'air', name: 'Air Fights', sceneKey: 'GameScene',
    levels: getLevels().map(l => ({ id: l.id, name: l.name })) },
  { id: 'battlefield', name: 'Battlefield', sceneKey: 'BattlefieldScene',
    levels: getBattlefieldLevels().map(l => ({ id: l.id, name: l.name })) },
];

export function getSections(): SectionConfig[];
export function getSceneKeyForLevel(levelId: string): string; // defaults to 'GameScene'
```

---

## 6. Scene flow & routing

### 6.1 `GameContainer.tsx`

Add `BattlefieldScene` to the Phaser scene array (order after `GameScene`,
before/with `UIScene`):

```ts
scene: [BootScene, PreloadScene, GameScene, BattlefieldScene, UIScene],
```

### 6.2 `PreloadScene.ts`

- **Preload battlefield-shared assets** alongside the current generic ones
  (guarded by `textures.exists`): the truck sprite `sprites/machines/ernhardt_truck.png`
  as `ernhardt_truck`. (The map image stays level-specific and is loaded in
  `BattlefieldScene.preload()`, mirroring how air backgrounds load per level.)
- **Resolve the target scene** on start:

```ts
gameEvents.once(EVENTS.START_GAME, ({ levelId }) => {
  this.buildPlayerTexture();
  this.scene.start(getSceneKeyForLevel(levelId), { levelId });
});
```

`EXIT_TO_MENU` still returns to `PreloadScene` (the idle hub), which re-arms this
listener — unchanged.

---

## 7. BattlefieldScene

Lifecycle parallels `GameScene` so the shared pieces (player, bullets, combat,
interpolation, UIScene, pause/restart/exit, registry HUD writes) behave
identically. Differences:

### 7.1 `init` / `preload`

- `init({ levelId })` resolves the `BattlefieldLevelConfig` from the battlefield
  registry (fallback to the first battlefield level).
- `preload()` loads the map image under a namespaced key
  (`map_<set>` → `backgrounds/battlefield/level_map.png`), guarded by
  `textures.exists`.

### 7.2 `create`

1. Read `battlefield/world.json`. Compute `world.width = tileWidth * widthTiles`,
   `world.height = tileHeight`. Set physics world bounds; gravity off.
2. `InterpolationSystem` created.
3. `TerrainSystem.create(mapKey, level.ground)` (see §8) — builds the tiled
   background and the `groundYAt(x)` curve.
4. Bullet pools (player + enemy), same as `GameScene`.
5. `PlayerPlane` spawned (e.g. at `world.width * 0.2`, above the ground curve),
   registered with interpolation, `'fire'` wired to `spawnBullet`.
6. Camera: `setBounds(0, 0, world.width, world.height)`, follow the player with
   `camera.lerp`, **`setZoom(battlefield camera.zoom)`** (a fixed, configurable
   zoom — *not* the air levels' height-derived zoom, since there is no vertical
   parallax driving the framing). Recompute viewport on `resize`.
7. Keys (WASD + F) and touch input identical to `GameScene` (touch reads from
   `UIScene` joystick).
8. `CombatSystem` created.
9. Registry seed: `playerHealth`, `playerMaxHealth`, `enemies: []`.
10. `BattlefieldLevelManager` constructed + `start()` (see §9).
11. Launch `UIScene` in parallel (HUD + joystick + pause button reused as-is).
12. Same `ESC`/`PAUSE_GAME`/`RESUME_GAME`/`RESTART_GAME`/`EXIT_TO_MENU` wiring and
    `shutdown` cleanup as `GameScene`. Emit `GAME_STARTED`.

### 7.3 `update` (per frame, when not game-over)

1. Player input → `handleInput` → `updatePhysics` (unchanged steering/feel).
2. **Horizontal wrap:** `player.x < 0 → world.width`, `> world.width → 0`
   (identical to air). **Ceiling:** clamp `player.y ≥ ceiling`.
3. **Ground crash (player):** if `player.y ≥ groundYAt(player.x)` → `triggerDefeat('ground')`.
4. `BattlefieldLevelManager.update(delta)` — spawns/advances stages; last stage
   cleared → VICTORY.
5. **Enemy planes:** for each live enemy, `updateAI(delta, ctx)` with the
   battlefield ground height (`ctx.groundY = groundYAt(enemy.x)` so the existing
   ground-avoidance AI respects the curve under each plane), `updateSmoke`,
   horizontal wrap. Enemies that reach the ground are a ground-kill (explode +
   remove), same as air.
6. **Trucks:** `BattlefieldLevelManager.updateMachines(delta)` advances each truck
   (drive left, snap Y to the ground curve), and culls trucks that exit the play
   area (see §9.3).
7. **Bullet culling:** camera-cull as today, plus **player & enemy bullets die on
   ground impact** (`bullet.y ≥ groundYAt(bullet.x)`).
8. **Combat:**
   - `checkBulletTargetsCollision(playerBullets, [...enemies, ...trucks])` →
     hits; killed planes explode `explosion_air` (or ground burst if they reached
     ground), killed trucks explode the ground `explosion` at the truck's
     ground position and are removed.
   - `checkEnemyBulletPlayerCollision` unchanged (only enemy planes shoot).
9. Registry write: enemy + truck health-bar descriptors (trucks included so the
   floating health bar shows over them), `stageInfo`, `playerAltitude`
   (`groundYAt(player.x) − player.y`, floored at 0) for the HUD.
10. `TerrainSystem.update(camera)` — keep the tiled background positioned for the
    current view (no parallax math; pure scroll).

### 7.4 Game over

Reuse `GameScene`'s victory/defeat structure verbatim (800 ms victory delay;
`'ground'` immediate burst; `'fall'` crash). The only change is `groundY` is now
`groundYAt(x)` rather than a constant.

---

## 8. TerrainSystem (`src/game/systems/TerrainSystem.ts`)

Replaces `ParallaxSystem` for this scene. Responsibilities:

### 8.1 Background

Draw the map image as a horizontally repeating background covering the full
world. Simplest correct approach: a `TileSprite` of size `world.width × world.height`
at depth `-100`, origin `(0,0)`, anchored at world `(0,0)`. Because the world is
`tileWidth × widthTiles` wide, the image repeats exactly `widthTiles` times and the
seam coincides with the wrap boundary. `update(camera)` is a no-op for a
world-anchored TileSprite (the camera does the scrolling); it exists for symmetry
and future effects.

### 8.2 Ground curve & collision

- Build `groundYAt(x: number): number`:
  1. `xt = ((x % tileWidth) + tileWidth) % tileWidth` (periodic).
  2. Linear-interpolate between the two bracketing control points (points are
     sorted by `x`, first `x = 0`, last `x = tileWidth` with equal `y` for a
     seamless wrap).
- This single function backs **all** collision queries: player crash, enemy
  ground-kill, bullet ground impact, and truck driving height. No physics bodies
  for the terrain — cheap and deterministic, matching the "specify collision via
  config" decision.

> Optional polish (not required): draw a thin debug polyline of the curve when a
> `?debugTerrain` flag is present, to ease tuning the JSON points. Keep it behind
> a flag and out of shipping builds.

---

## 9. BattlefieldLevelManager (`src/game/systems/BattlefieldLevelManager.ts`)

Adapted from `LevelManager`. Same stage/quota/`maxConcurrent`/reinforcement model
and the same callbacks (`onStageChanged`, `onLevelCompleted`). Difference: a stage
group `type` may resolve to **either** a flying enemy (`getEnemyBehavior`) **or** a
machine (`getMachine`), and the two spawn differently and are tracked in separate
active lists (planes vs trucks). `getRemainingCount` / quota logic counts both.

### 9.1 Spawning planes

Identical to the air `LevelManager`: off-screen ring around the player, clamped
between ceiling and the local ground height. Reuse the existing `fighter`
archetype and `EnemyPlane`.

### 9.2 Spawning trucks

- Spawn position: **just off the right edge of the camera view**
  (`camera.worldView.right + margin`), `y = groundYAt(x) − truckHalfHeight`.
- Create a `Machine` (see §10), `setFlipX(true)` so the right-facing sprite drives
  left, scaled to `displayWidth`.
- Register for interpolation; push to the `activeMachines` list.

### 9.3 Updating / culling trucks

- Each frame: `machine.x -= speed * dt`; `machine.y = groundYAt(machine.x) − halfHeight`
  (so it hugs the curve). Optionally set a slight rotation to match the local
  slope (nice-to-have).
- **Removal:** when a truck's right edge passes `camera.worldView.left − margin`
  (it has driven past the player off-screen left), remove it from memory/map
  (`removeMachine` → unregister interpolation + `destroy`). A truck removed by
  **escape** counts toward stage completion the same as one destroyed — this keeps
  the stage-quota VICTORY reachable. (If we later want "must destroy all",
  re-queue escaped trucks instead; called out as a future toggle.)
- **Death:** when `health ≤ 0`, spawn the ground `explosion` at the truck's
  ground contact point, hide/destroy the truck, remove it from the active list
  (counts toward the quota). This is wired through the scene's combat handling in
  §7.3.

---

## 10. Machine entity (`src/game/entities/Machine.ts`)

A lightweight ground vehicle, **not** a `Plane` (no flight). Extends
`Phaser.Physics.Arcade.Sprite` and implements the shared `Damageable` interface so
`CombatSystem` and the HUD treat it like any other target.

| Member | Description |
|---|---|
| `machineConfig` | from `truck.json` |
| `currentHealth` / `maxHealth` | from config |
| `takeDamage(n) → boolean` | subtract HP, return killed |
| `getHealthPercent()` / `isAlive()` | as on `Plane` |
| `drive(dt, groundYAt)` | move left at `speed`, snap Y to the curve |
| ctor | sets texture, `setFlipX(true)`, `setDisplaySize(displayWidth, derivedHeight)`, origin `(0.5, 1)` so the wheels sit on the ground line, body gravity off, world-bounds off |

`CombatSystem.flashHit` already only needs `setTint`/`clearTint`/`active`, so the
red hit-flash works on trucks for free.

### CombatSystem generalisation

Introduce a minimal interface and retarget the bullet→target method:

```ts
export interface Damageable extends Phaser.GameObjects.GameObject {
  x: number; y: number;
  takeDamage(amount: number): boolean;
  isAlive(): boolean;
}
// rename/add: checkBulletTargetsCollision(bullets, targets: Damageable[]): { target: Damageable; killed: boolean }[]
```

`EnemyPlane` already satisfies this; `Machine` will too. The air `GameScene` keeps
working (it passes `EnemyPlane[]`, which is assignable to `Damageable[]`). Keep a
thin `checkBulletEnemiesCollision` wrapper if convenient to avoid touching
`GameScene`.

---

## 11. Menu — two-step section navigation (`StartScreen.tsx`)

Current `StartScreen` renders a flat level list plus a Garage entry, and already
has a sub-view pattern (`showSelector` swaps to `PlaneSelector`). Extend that:

- State: `view: 'sections' | 'levels'`, `activeSectionId`.
- **Sections view:** title + one button per `getSections()` entry (`Air Fights`,
  `Battlefield`) + the existing Garage entry.
- **Levels view:** a Back button (mirrors `PlaneSelector`'s Back), the section
  name, and that section's level buttons (with the `✓` completion badge via the
  existing `completed` list). `onClick → onStart(level.id)` — unchanged.
- `onStart` still calls `useGame.startGame(levelId)` → emits `START_GAME`. No
  `useGame` change needed; routing happens in `PreloadScene` (§6.2).

Completion persistence (`mr_completed_levels`) is shared, so battlefield levels get
the same `✓` behaviour for free.

---

## 12. Assets

| Asset | Where loaded | Key |
|---|---|---|
| `ernhardt_truck.png` | `PreloadScene` (shared) | `ernhardt_truck` |
| `level_map.png` | `BattlefieldScene.preload()` (per level, namespaced) | `map_battlefield` |
| `explosion` / `explosion_air` | already loaded in `PreloadScene` | reused for truck/plane deaths |

The truck sprite is `875×372` (aspect ≈ 2.35). At `displayWidth = 200` it renders
≈ `200×85`, comparable to the stone bases in the map art (tune `displayWidth`
after first run).

---

## 13. Win / lose summary (battlefield)

| Condition | Outcome |
|---|---|
| Last stage cleared (all planes + trucks of the quota gone) | VICTORY |
| Player Y ≥ `groundYAt(playerX)` (crash) | DEFEAT |
| Player health 0 | DEFEAT |
| Truck destroyed | ground explosion, removed, counts toward quota |
| Truck drives off-screen left | removed, counts toward quota (future toggle: re-queue) |
| Enemy plane destroyed / reaches ground | same as air levels |

---

## 14. Implementation steps (ordered)

1. **Types** — add the new interfaces to `game.types.ts` (§5.1).
2. **Config data** — create `battlefield/world.json`, `machines/truck.json` +
   `machines/index.ts`, `levels/battlefield-1.json` + `levels/index.ts`, and
   `sections.ts` (§5).
3. **TerrainSystem** — tiled background + `groundYAt` (§8). Unit-check the curve
   interpolation + periodic wrap in isolation.
4. **Machine entity** + `CombatSystem` generalisation (`Damageable`) (§10).
5. **BattlefieldLevelManager** — plane ring spawn (reuse) + truck right-edge spawn,
   drive, cull, death (§9).
6. **BattlefieldScene** — wire steps 3–5 into the `GameScene`-shaped lifecycle
   (§7), including ground-curve-aware crash/cull/AI context.
7. **Routing** — `GameContainer` scene array + `PreloadScene` scene resolution &
   truck preload (§6).
8. **Menu** — two-step `StartScreen` (§11).
9. **Tune** — run, then adjust `world.zoom`, `ground.points`, truck
   `displayWidth/health/speed`, and stage quotas for feel.
10. **Docs** — add `docs/battlefield.md`; cross-link from
    `architecture.md` / `scenes.md` / `levels.md`. Run `tsc`, `eslint`,
    `npm run build`.

---

## 15. Out of scope (future)

- Trucks (or other machines) firing anti-air at the player.
- Additional machine types (`ww1_tank`, `ernhardt_launcher`, `hummer_jeep`
  already present in `sprites/machines/`).
- Slope-matched truck rotation polish and dust/track effects.
- Per-battlefield-level distinct maps/variants and a battlefield-specific enemy
  archetype (currently reuses `fighter`).
- "Must destroy every truck" victory variant (escaped trucks re-queued).
```

