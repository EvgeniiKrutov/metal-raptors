# Levels & Stages — Implementation Spec

> Feature spec for introducing configurable **Levels**, multi-enemy **Stages**, a
> **level selector** start menu, and a reworked **victory/defeat** flow.
>
> Status: Ready for implementation · Target codebase: `metal-raptors` (React + Phaser 3)

---

## 1. Goal

Replace the current hardcoded "single stationary-ish enemy → instant VICTORY" loop
with a data-driven **Level** concept:

- A **level** is a configurable JSON file describing its background and an ordered
  list of **stages**.
- A **stage** spawns a quota of enemies (of configurable types) in random spots
  around the player. The stage is **cleared** when every enemy spawned for it is
  destroyed.
- **VICTORY** fires only after the **last stage of the level** is cleared.
- The **start menu** becomes a **level selector**. There is always at least one
  level (Level 1) shipped.
- The **victory** screen gains **Continue** (→ back to the selector) and **Restart**
  (→ replay the same level from stage 1).
- The **defeat** screen gains **Restart** (replay level) and **Menu** (→ selector).

---

## 2. Decisions (locked)

These were confirmed up-front and drive the design below.

| Topic | Decision |
|---|---|
| **Within-stage spawning** | **Concurrent cap + reinforcements.** Keep at most `maxConcurrent` enemies alive; as they die, spawn replacements until the stage's total quota is exhausted. |
| **Spawn placement** | **Off-screen ring.** Spawn at a configurable radius just outside the camera view, at a random angle, so enemies fly in. Clamp Y to stay between the ceiling and the ground. |
| **Stage transitions** | **Immediate, no announcement.** When a stage clears, the next stage begins spawning right away. |
| **Defeat screen** | **Restart + Menu.** |
| **Victory screen** | **Continue + Restart** (as requested). |
| **Progression** | **All levels always unlocked; completion is remembered.** Completed level ids are persisted to `localStorage` and shown as a badge in the selector. No locking. |
| **Level file delivery** | **Bundled JSON imports** under `src/game/config/data/levels/`, matching the existing `data/enemies/*.json` pattern (edit + rebuild to change). |
| **Background field** | A single base name (e.g. `"verden"`) plus a variant (e.g. `"dawn"`). The 3 layer image paths are **derived by naming convention** from these (see §5). |

---

## 3. Current architecture (what we build on)

- **Scene flow:** `BootScene` → `PreloadScene` (loads generic assets, generates
  textures, then `gameEvents.once(START_GAME)` → `GameScene`). `UIScene` runs in
  parallel for health bars. See `src/game/scenes/`.
- **Data is JSON-driven:** `src/game/config/data/` holds `player.json`,
  `world.json`, `physics.json`, `bullet.json`, and `enemies/fighter.json` (full
  enemy behavior incl. AI tuning). Assembled in `src/game/config/gameConfig.ts`.
- **Single-enemy assumption (to be removed):** `GameScene` owns exactly one
  `EnemyPlane`; `CombatSystem.checkBulletEnemyCollision(bullets, enemy)` takes one
  enemy; `UIScene` reads one set of `enemyHealth` / `enemyScreenX/Y` registry keys.
- **React bridge:** `src/hooks/useGame.ts` + `gameEvents`/`EVENTS` (in
  `src/game/Game.ts`) drive `StartScreen` and `GameOverScreen`.

---

## 4. Level data model

### 4.1 Type definitions (`src/types/game.types.ts`, new)

```ts
/** One enemy composition entry within a stage. `type` references an
 *  enemy-behavior JSON id (e.g. "fighter" -> data/enemies/fighter.json). */
export interface StageEnemyGroup {
  type: string;   // enemy behavior id
  count: number;  // how many of this type the stage spawns in total
}

export interface StageConfig {
  /** Max enemies alive at any moment during this stage. */
  maxConcurrent: number;
  /** Total enemies to spawn this stage (sum of group counts), by type. */
  enemies: StageEnemyGroup[];
}

export interface LevelConfig {
  id: string;            // unique, stable; used as the localStorage key
  name: string;          // shown in the selector
  background: string;    // base set name, e.g. "verden"
  backgroundVariant: string; // e.g. "dawn" | "dusk" | "night" | "fog"
  stages: StageConfig[];
}
```

### 4.2 Example level (`src/game/config/data/levels/level-1.json`)

```json
{
  "id": "level-1",
  "name": "First Sortie",
  "background": "verden",
  "backgroundVariant": "dawn",
  "stages": [
    { "maxConcurrent": 2, "enemies": [ { "type": "fighter", "count": 2 } ] },
    { "maxConcurrent": 2, "enemies": [ { "type": "fighter", "count": 3 } ] },
    { "maxConcurrent": 3, "enemies": [ { "type": "fighter", "count": 4 } ] }
  ]
}
```

> Level 1 ships using only the existing `fighter` enemy type (the only behavior
> JSON that currently exists). Additional types are added later simply by adding
> `data/enemies/<id>.json` and referencing the id from a stage.

### 4.3 Level registry (`src/game/config/data/levels/index.ts`, new)

Because levels are bundled, an explicit index keeps an ordered list:

```ts
import level1 from './level-1.json';
import { LevelConfig } from '../../../../types/game.types';

export const LEVELS: LevelConfig[] = [level1 as LevelConfig];

export function getLevels(): LevelConfig[] { return LEVELS; }
export function getLevelById(id: string): LevelConfig | undefined {
  return LEVELS.find(l => l.id === id);
}
```

### 4.4 Enemy behavior lookup

A stage's `type` must resolve to an `EnemyBehaviorConfig`. Add a registry mirroring
the levels one (`data/enemies/index.ts`):

```ts
import fighter from './fighter.json';
export const ENEMY_BEHAVIORS: Record<string, EnemyBehaviorConfig> = {
  fighter: fighter as EnemyBehaviorConfig,
};
export function getEnemyBehavior(id: string): EnemyBehaviorConfig { /* throws if missing */ }
```

This replaces the direct `import fighterBehavior from '.../fighter.json'` in
`GameScene`.

### 4.5 Spawn tuning (global)

Add a `spawn` block (new `data/spawn.json`, surfaced via `gameConfig.spawn`):

```json
{
  "ringMargin": 220,      // px beyond the camera edge to spawn at
  "ringJitter": 160,      // extra random distance added to the ring radius
  "minCeilingMargin": 80, // keep spawn Y >= ceiling + this
  "minGroundMargin": 200  // keep spawn Y <= groundY - this
}
```

---

## 5. Background resolution & loading

The level names a base set + variant. Derive the three layer keys/paths by
convention (matches `public/backgrounds/<set>/<set>_<layer>_<variant>.png`):

```
background -> backgrounds/verden/verden_background_dawn.png
foreground -> backgrounds/verden/verden_foreground_dawn.png
ground     -> backgrounds/verden/verden_ground_dawn.png
```

Helper (e.g. in `src/game/utils/helpers.ts`):

```ts
export function backgroundLayerPaths(set: string, variant: string) {
  const base = `backgrounds/${set}/${set}`;
  return {
    bg:     `${base}_background_${variant}.png`,
    fg:     `${base}_foreground_${variant}.png`,
    ground: `${base}_ground_${variant}.png`,
  };
}
```

**Loading strategy (per-level):** background images are no longer preloaded in
`PreloadScene`. Instead they load when the chosen level starts:

- `GameScene.init(data: { levelId })` stores `levelId`.
- `GameScene.preload()` loads the three layer images using **level-namespaced
  texture keys** so switching levels never collides with a cached key:
  `bg_<set>_<variant>`, `fg_<set>_<variant>`, `ground_<set>_<variant>`.
  (Phaser skips re-loading a key it already has cached, so revisits are instant.)
- `ParallaxSystem.create(...)` and the ground tile sprite must take the layer keys
  as parameters instead of the current hardcoded `'bg'`/`'fg'`/`'ground'`.

> `PreloadScene` keeps loading the **generic** assets (plane sprites → `player`/
> `enemy` textures, `bullet`, `explosion`, `smoke`, audio). Those are level-agnostic.

---

## 6. New system: `LevelManager`

`src/game/systems/LevelManager.ts` — owns level progress and enemy spawning.
Created by `GameScene` after the player exists.

### Responsibilities

- Hold the active `LevelConfig`, current `stageIndex`, and per-stage counters:
  `spawnedThisStage`, `remainingToSpawn` (per type, flattened to a queue), and a
  live list of active `EnemyPlane`s.
- Each `update(delta)`:
  1. If `activeEnemies.length < stage.maxConcurrent` **and** the stage still has
     enemies queued to spawn → spawn one (off-screen ring, §7) and decrement the
     queue.
  2. Remove dead enemies from `activeEnemies` (also unregister from
     `InterpolationSystem`).
  3. **Stage clear test:** `remainingToSpawn === 0 && activeEnemies.length === 0`.
     - If more stages remain → `stageIndex++`, rebuild the spawn queue, continue
       immediately (no announcement).
     - If it was the last stage → emit a `levelCompleted` signal back to
       `GameScene` (→ VICTORY).
- Expose `getActiveEnemies(): EnemyPlane[]` for combat + UI.

### Spawn queue

Flatten `stage.enemies` (`[{type:'fighter',count:4}]`) into a queue of type ids.
Spawning pops the next id, looks up its behavior via `getEnemyBehavior(id)`, and
constructs an `EnemyPlane` exactly as today (`new EnemyPlane(scene, x, y, behavior)`),
wiring its `'fire'` event to `scene.spawnEnemyBullet`.

---

## 7. Spawn placement (off-screen ring)

When spawning, compute a point around the **player**:

```
angle  = random(0, 2π)
radius = (max(viewWidth, viewHeight) / 2) + spawn.ringMargin + random(0, spawn.ringJitter)
x = player.x + cos(angle) * radius
y = clamp(player.y + sin(angle) * radius,
          ceiling + spawn.minCeilingMargin,
          groundY - spawn.minGroundMargin)
```

- Use the player's authoritative (non-interpolated) position — spawning happens
  inside the `update` window where positions are true (see `scenes.md` notes).
- Horizontal world wrap still applies to enemies once alive (existing logic), so
  an x outside `[0,world.width]` is fine; normalize with the same wrap rule.

---

## 8. Multi-enemy refactor

The single-enemy assumption must be generalized.

### `GameScene`
- Replace the `enemy!: EnemyPlane` field with the `LevelManager` (which owns the
  enemy list). Remove the hardcoded `fighter.json` import and the fixed spawn at
  `world * 0.75`.
- In `create()`: read `levelId` (from `init`), look up the `LevelConfig`, build the
  `ParallaxSystem`/ground from that level's background keys, then construct the
  `LevelManager` and let it drive spawning.
- In `update()`:
  - Drive `LevelManager.update(delta)` (spawning + stage advancement).
  - Build the `AIContext` per enemy (`targetVisible`, `enemyVisible`, etc.) and call
    `updateAI` for each active enemy. The `target` is always the player.
  - Wrap/cull each active enemy as the single enemy is wrapped today.
  - Replace `checkBulletEnemyCollision(bullets, enemy)` with a loop /
    `checkBulletEnemiesCollision(bullets, enemies[])` (see below). On any enemy
    death, remove it from the active list; do **not** trigger VICTORY here.
  - VICTORY is triggered only from `LevelManager`'s "last stage cleared" signal.
  - The "enemy hit the ground ⇒ VICTORY" shortcut is removed; a grounded enemy is
    just a dead enemy (explode + remove from active list, may advance the stage).

### `CombatSystem`
- Add `checkBulletEnemiesCollision(bullets, enemies: EnemyPlane[])` that overlaps
  the bullet group against each live enemy, applies damage, flashes, and returns
  the list of enemies hit/killed this frame (so the scene can fire `onDamaged`,
  spawn explosions, and update per-enemy registry data).
- Keep `checkEnemyBulletPlayerCollision` as-is.

### `InterpolationSystem`
- Register each enemy on spawn, unregister on death (already supports
  register/unregister; `LevelManager` calls these).

---

## 9. UI changes

### 9.1 Enemy health bars (`UIScene`)
- The single `enemyHealth` / `enemyScreenX/Y` registry triplet is replaced by an
  **array** of active-enemy descriptors written by `GameScene` each frame:
  `registry.set('enemies', [{ screenX, screenY, percent }, ...])`.
- `UIScene.update()` iterates that array and draws one floating crimson bar per
  enemy (reuse `drawHealthBar`), applying the same off-screen hide rule
  (`screenX` within `[-200, width+200]`).
- Player health bar is unchanged.

### 9.2 Stage/progress HUD (optional, recommended)
- Emit `STAGE_CHANGED { stageIndex, totalStages }` when a stage begins and
  `ENEMIES_REMAINING { count }` (queued + alive) as it changes, so a small
  "Stage 2/3 — 4 left" indicator can be drawn in `UIScene` (top-right). Not
  required for correctness; include if cheap.

### 9.3 Start menu → level selector (`StartScreen.tsx`)
- Replace the single "Start" button with a list/grid of levels from `getLevels()`.
- Each row shows the level `name` and a **completed** badge (✓) when its id is in
  the persisted completed-set.
- Selecting a level calls `onStart(levelId)`; the launch button stays disabled
  until `ready` (assets loaded), exactly as today.

### 9.4 Game-over overlay (`GameOverScreen.tsx`)
- **VICTORY:** title + two buttons — **Continue** (`onContinue` → selector) and
  **Restart** (`onRestart` → replay level).
- **DEFEAT:** title + two buttons — **Restart** (`onRestart`) and **Menu**
  (`onMenu` → selector).
- Component takes `outcome`, `onRestart`, and a single `onExitToMenu` handler
  (Continue and Menu both return to the selector — same action, different label).

---

## 10. Events & scene/React flow

### 10.1 `EVENTS` additions/changes (`src/game/Game.ts`)

| Event | Payload | Direction | Notes |
|---|---|---|---|
| `START_GAME` | `{ levelId }` | React → Phaser | now carries the chosen level |
| `RESTART_GAME` | `{ levelId }` *(or none — scene already knows)* | React → Phaser | replay current level from stage 1 |
| `EXIT_TO_MENU` | — | React → Phaser | **new**: tear down gameplay, return to idle menu |
| `GAME_OVER` | `{ outcome, levelId }` | Phaser → React | add `levelId` so React can mark completion |
| `LEVEL_COMPLETED` | `{ levelId }` | Phaser → React | optional; or infer from `GAME_OVER` VICTORY |
| `STAGE_CHANGED` | `{ stageIndex, totalStages }` | Phaser → React/UI | optional HUD |
| `PLAYER_HEALTH_CHANGED` | `{ current, max }` | Phaser → React | unchanged |
| `ENEMY_HEALTH_CHANGED` | — | — | **removed** (per-enemy bars now via registry array) |

### 10.2 Menu re-entry mechanism

Currently `PreloadScene` does `gameEvents.once(START_GAME, …)` and is consumed on
first launch. To support returning to the menu and launching again:

- Treat `PreloadScene` as the **idle hub**. Its `create()` (re-)registers
  `gameEvents.once(START_GAME, ({ levelId }) => this.scene.start('GameScene', { levelId }))`
  and emits `ASSETS_LOADED`. Because assets are cached, re-entering `PreloadScene`
  is instant and re-arms the listener.
- `START_GAME { levelId }` → `GameScene` starts with that level.
- `EXIT_TO_MENU` (from Continue/Menu) → `GameScene.handleExit()`: stop `UIScene`,
  then `this.scene.start('PreloadScene')`. React sets `isStarted = false` to show
  the selector overlay on top of the idle scene.
- `RESTART_GAME` → `GameScene.handleRestart()`: `this.scene.restart({ levelId })`
  with the stored `levelId` (today it calls `scene.restart()` with no data —
  must pass the level so the same one replays).

### 10.3 React `useGame` changes (`src/hooks/useGame.ts`)
- Track `selectedLevelId`.
- `startGame(levelId)` → `setSelectedLevelId(id); setIsStarted(true);
  emit START_GAME { levelId }`.
- `restartGame()` → clear game-over; `emit RESTART_GAME { levelId: selectedLevelId }`.
- `exitToMenu()` → clear game-over; `setIsStarted(false); emit EXIT_TO_MENU`.
- On `GAME_OVER` with `outcome === 'VICTORY'` → add `levelId` to the persisted
  completed-set (§11) and update state for the badge.

### 10.4 `App.tsx`
- Selector (`StartScreen`) is shown while `!isStarted`.
- `GameOverScreen` overlay on game over, wired to `restartGame` and `exitToMenu`.

---

## 11. Persistence (completion only)

- `localStorage` key: `mr_completed_levels` → JSON array of completed level ids.
- Small module `src/game/utils/progress.ts` (or inline in `useGame`): `getCompleted(): string[]`,
  `markCompleted(id)`, `isCompleted(id)`. Guard all access in try/catch (private
  mode / disabled storage) and fall back to in-memory.
- The selector reads this to render ✓ badges. No locking, no stage-level save.

---

## 12. Win / lose conditions (updated)

| Condition | Outcome |
|---|---|
| Last stage of the level cleared (all enemies of all stages destroyed) | **VICTORY** |
| Player collides with ground | **DEFEAT** |
| Player health reaches 0 (enemy fire) | **DEFEAT** |
| Individual enemy destroyed | *Stage progress only* — never an immediate VICTORY |

---

## 13. Edge cases & notes

- **Empty/zero-count stage:** a stage with no queued enemies clears instantly and
  advances the same frame; ensure the clear test runs after spawning so a level of
  all-empty stages still resolves to VICTORY without a hang.
- **Spawn while wrapped:** enemies spawned off the ring may land outside world X;
  apply the existing wrap normalization so they appear correctly.
- **maxConcurrent > remaining quota:** spawn only up to whatever is queued; never
  exceed the stage total.
- **Restart cleanup:** `scene.restart({ levelId })` re-runs `create`, which rebuilds
  the `LevelManager` from stage 0 — verify all active enemies and bullets are reset
  and `InterpolationSystem` registrations don't leak (unregister on shutdown).
- **Per-enemy registry array** must be cleared/rewritten every frame so dead
  enemies' bars disappear.
- **Background key collision:** always use level-namespaced texture keys
  (`bg_<set>_<variant>`) — do not reuse the bare `bg`/`fg`/`ground` keys.

---

## 14. File-by-file change list

**New**
- `src/game/config/data/levels/level-1.json` — first level.
- `src/game/config/data/levels/index.ts` — level registry + lookups.
- `src/game/config/data/enemies/index.ts` — enemy-behavior registry + lookup.
- `src/game/config/data/spawn.json` — spawn tuning.
- `src/game/systems/LevelManager.ts` — stage/spawn/progress engine.
- `src/game/utils/progress.ts` — localStorage completion helpers (optional split).

**Modified**
- `src/types/game.types.ts` — `LevelConfig`, `StageConfig`, `StageEnemyGroup`,
  `spawn` config type; extend `gameConfig` type.
- `src/game/config/gameConfig.ts` — surface `spawn`.
- `src/game/scenes/PreloadScene.ts` — stop loading backgrounds; act as idle hub;
  re-arm `START_GAME` with `{ levelId }`.
- `src/game/scenes/GameScene.ts` — `init(levelId)` + `preload()` background load;
  build from `LevelConfig`; own `LevelManager`; multi-enemy update/combat/cull;
  VICTORY only on level complete; `handleRestart({levelId})`, `handleExit()`.
- `src/game/systems/ParallaxSystem.ts` — accept background layer keys as params.
- `src/game/systems/CombatSystem.ts` — `checkBulletEnemiesCollision(bullets, [])`.
- `src/game/scenes/UIScene.ts` — per-enemy floating bars from `registry('enemies')`;
  optional stage indicator.
- `src/game/Game.ts` — new/changed `EVENTS` (`EXIT_TO_MENU`, payloads).
- `src/hooks/useGame.ts` — `selectedLevelId`, `exitToMenu`, completion persistence,
  payloads.
- `src/components/StartScreen.tsx` — level selector list with ✓ badges.
- `src/components/GameOverScreen.tsx` — VICTORY (Continue+Restart) / DEFEAT
  (Restart+Menu).
- `src/components/App.tsx` — wire new handlers.

---

## 15. Implementation checklist

- [ ] Add level/stage/spawn types; level + enemy registries; `level-1.json`.
- [ ] Per-level background loading with namespaced keys; parametrize ParallaxSystem
      + ground tile.
- [ ] `LevelManager`: spawn queue, concurrent cap + reinforcements, off-screen ring
      placement, stage advancement, last-stage → VICTORY signal.
- [ ] Multi-enemy `GameScene` update loop (AI per enemy, wrap/cull, combat).
- [ ] `CombatSystem.checkBulletEnemiesCollision`.
- [ ] Per-enemy floating health bars in `UIScene`.
- [ ] Events: `START_GAME{levelId}`, `RESTART_GAME{levelId}`, `EXIT_TO_MENU`,
      `GAME_OVER{outcome,levelId}`; remove `ENEMY_HEALTH_CHANGED`.
- [ ] Menu re-entry via idle `PreloadScene`; `handleExit`/`handleRestart`.
- [ ] `StartScreen` level selector + completion badges.
- [ ] `GameOverScreen` victory/defeat buttons.
- [ ] `useGame` selected-level state + localStorage completion.
- [ ] Verify restart/exit cleanup (no leaked enemies, bullets, or interpolation
      registrations).

---

*Spec version: 1.0 · 2026-06-15*
