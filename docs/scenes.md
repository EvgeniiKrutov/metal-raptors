# Scenes

## BootScene

`src/game/scenes/BootScene.ts`

The very first scene Phaser starts. Has no assets to preload; immediately transitions to `PreloadScene` in `create()`.

---

## PreloadScene

`src/game/scenes/PreloadScene.ts`

Loads the **generic, level-agnostic** assets, generates runtime textures, and
then acts as the **idle hub** the game returns to between sorties.

### Asset Loading

| Key | File |
|---|---|
| `player_temp` | `sprites/planes/world_war_1/Sopwith_Camel.png` |
| `enemy_temp` | `sprites/planes/world_war_1/Fokker_Dr_1.png` |
| `smoke` | `effects/smoke.png` |
| `bullet` | `effects/bullet.png` |
| `speedometer` | `interface/speedometer.png` |
| `explosion` | `effects/explosion.png` (spritesheet) |
| `bullet_shot` | `sounds/bullet_shot_1.wav` |

Backgrounds are **not** loaded here — each level loads its own three layers in
`GameScene.preload()` under namespaced keys (see [levels.md](levels.md)). Every
load and texture-generation step is guarded by `textures.exists` /
`cache.audio.exists`, so re-entering the scene is instant and never duplicates a
key.

### Texture Generation

After loading, two plane textures are generated and cached:

**`player` / `enemy`** — Built from the loaded sprites via `RenderTexture`,
scaled to a base width with aspect ratio preserved. The enemy texture is flipped
vertically (`setFlipY(true)`). The `explosion` animation is created once.

### Idle hub / menu re-entry

`create()` (re-)arms a single `gameEvents.once(START_GAME, ({ levelId }) =>
this.scene.start('GameScene', { levelId }))` and emits `ASSETS_LOADED`. Returning
from a game (`EXIT_TO_MENU`) does `scene.start('PreloadScene')`, which re-runs
this `create()` and re-arms the listener, so the next level launch works exactly
like the first.

### Loading UI

A progress bar and title text are shown during asset loading. The bar width tracks the `progress` event; the loading text updates per-file via the `fileprogress` event. The loader is centred on the **live screen size** and recentres on `resize`, so it stays centred on phones as well as desktop (see [display-and-responsiveness.md](display-and-responsiveness.md)).

---

## GameScene

`src/game/scenes/GameScene.ts`

Main gameplay scene. Owns the player, the `LevelManager`, and drives the
per-frame update loop. It is multi-enemy: the enemy list is owned by the
`LevelManager`, not the scene.

### `init(data)` + `preload()`

`init({ levelId })` resolves the chosen `LevelConfig` (falling back to the first
level). `preload()` then loads that level's three background layers under
namespaced keys (`bg_<set>_<variant>`, …), guarded by `textures.exists`. See
[levels.md](levels.md).

### Setup (`create`)

1. Physics world bounds set to `world.width × world.height`; arcade gravity disabled
2. `InterpolationSystem` created; `ParallaxSystem.create(bgKey, fgKey)` builds the level's background layers
3. Ground visual: a tile sprite at `worldHeight − 80` using the level's ground key
4. Bullet pools created: player bullets (max 120) and enemy bullets (max 120)
5. `PlayerPlane` spawned at 20% × 10% of world size and registered with the `InterpolationSystem`
6. Camera follows the player with configurable lerp (round-pixels disabled); bounds set to the full world. Zoom is derived from the screen height for a **consistent vertical view** (`zoom = screenHeight / display.height`) and is recomputed on every Scale Manager `resize`; see [display-and-responsiveness.md](display-and-responsiveness.md)
7. WASD + F keys registered; `CombatSystem` initialised
8. Player health + an empty `enemies` array written to the registry
9. `LevelManager` constructed (with `onStageChanged` / `onLevelCompleted` callbacks) and `start()`ed — it drives all enemy spawning
10. `UIScene` launched in parallel
11. The `ESC` key handler is registered for pausing; `RESTART_GAME`, `EXIT_TO_MENU`, and `RESUME_GAME` listeners registered (removed on `shutdown`); `GAME_STARTED` emitted

### Update Loop

`update` runs between the `InterpolationSystem`'s `preupdate` hook and the physics step, so all positions read below are the true, non-interpolated values.

Each frame (when not game over):

1. **Player input & physics** — `handleInput` → `updatePhysics`
2. **LevelManager** — `update(delta)` handles spawning, stage advancement, and the last-stage → VICTORY signal; the scene bails immediately if that signal fired
3. **Enemy AI** — for each live enemy, build a per-enemy `AIContext` and call `updateAI`
4. **Screen wrap / ceiling** — player wraps left↔right and is clamped to Y ≥ 20
5. **Ground collision** — player Y ≥ `groundY` triggers DEFEAT; each enemy that reaches `groundY` is counted as destroyed (explode + remove)
6. **Bullet culling** — bullets outside the camera view + margin (64 px) are deactivated; enemy bullets also die on hitting the ground
7. **Combat** — `checkBulletEnemiesCollision` returns per-enemy hits; survivors get `onDamaged`, killed enemies are exploded and removed; enemy-bullet→player hits update health and may trigger DEFEAT
8. **Registry update** — the live enemies are written as an array of `{ screenX, screenY, percent }` descriptors plus a `stageInfo` object for `UIScene`; the player's `currentSpeed` (`playerSpeed`) and altitude above the ground (`playerAltitude` = `groundY − player.y`, floored at 0) are also written for the HUD readout
9. **Parallax update**

Individual enemy death is *never* an immediate VICTORY — only the `LevelManager`'s last-stage-cleared signal is.

### Game Over

- `triggerVictory()` — set after the last stage clears; an 800 ms delay lets the final explosion play, then the scene pauses and emits `GAME_OVER { outcome: 'VICTORY', levelId }`.
- `triggerDefeat(plane, cause)` — clears the enemy registry (so `UIScene` stops drawing enemy health bars for the rest of the defeat sequence), then `'ground'` explodes the player immediately, `'fall'` (health 0) plays the crash; on the explosion's animation-complete the scene pauses and emits `GAME_OVER { outcome: 'DEFEAT', levelId }`.
- `explodeEnemy(enemy)` — cosmetic per-enemy explosion (no game over): spawn the sprite, `hideWreck`, and `LevelManager.removeEnemy`.

The flag `isGameOver` prevents re-entry. `handleRestart({ levelId })` restarts the
scene with the stored level; `handleExit()` stops `UIScene` and returns to
`PreloadScene` (the idle hub).

### Pause / Resume

Pressing `ESC` during play calls `handlePause()`, which pauses `UIScene` then
`GameScene` and emits `GAME_PAUSED`. `Scene.pause()` keeps each scene rendering its
last frame but skips every update/system step, so all positions, velocities,
tweens, and timers freeze in place and resume exactly where they left off. The
pause window itself is rendered by React (see [react-integration.md](react-integration.md)).

- `handlePause()` — no-op when already game-over or already paused; pauses both scenes and emits `GAME_PAUSED`.
- `handleResume()` — fired by the React *Resume* button via `RESUME_GAME`; resumes both scenes from their frozen state.
- The React *Menu* button reuses the existing `EXIT_TO_MENU` → `handleExit()` path, which shuts the scene down and releases its resources even while paused.

Because a paused scene's input is disabled, `ESC` only opens the pause window —
resuming is driven by the React overlay through the global `gameEvents` emitter,
which fires regardless of scene state.

---

## UIScene

`src/game/scenes/UIScene.ts`

A parallel scene rendered on top of `GameScene`. Draws health bars each frame using `Phaser.GameObjects.Graphics`.

All HUD elements are laid out from the **live screen size** and re-flow on every Scale Manager `resize`: sizes/fonts scale by `uiScale = screenHeight / 1080` and elements anchor to the live screen edges (gauges + player bar top-left, stage indicator top-right, controls hint bottom-centre, touch controls in the bottom corners). See [display-and-responsiveness.md](display-and-responsiveness.md).

### Player Health Bar

Fixed to the top-left, just **right of the two instrument gauges** (so the gauges
own the corner for now):
- Position: `(HP_BAR_X, HP_BAR_Y)`, size: 220 × 22, vertically centred on the gauges
- Colour: `healthColour(percent)` — green above 60%, yellow above 30%, red below

### Enemy Health Bars

Read from the `enemies` registry array (one `{ screenX, screenY, percent }`
descriptor per live enemy, rewritten by `GameScene` every frame so dead enemies'
bars disappear). One crimson (`0xdc143c`) bar, 120 px wide, is drawn 44 px above
each enemy; a bar is skipped when its enemy is more than 200 px off-screen
horizontally.

### Altitude / Speed Gauges

Two instrument gauges sit side by side in the **top-left corner**, each drawn
from the `speedometer` interface texture (scaled to `GAUGE_WIDTH × GAUGE_HEIGHT`
via `setDisplaySize`). The readout values are printed **inside** each gauge's
display panel, centred on the frame:

- **Speed** (left gauge) shows `<n>km/h` from `playerSpeed`.
- **Altitude** (right gauge) shows `<n>m` from `playerAltitude`.

Both values come from the registry (written by `GameScene`) and are rounded to
whole integers with `Math.round`, so no fractional values are ever shown. The
text uses the pixel-art font **Press Start 2P** (loaded from Google Fonts in
`index.html`, with a `monospace` fallback) in amber `#fddb7f`. Because `update()`
re-`setText`s every frame, the readout re-renders with the web font automatically
once it finishes loading.

### Stage Indicator

A top-right text reads `Stage X/Y — N left` from the `stageInfo` registry object
(`stageIndex`, `totalStages`, `remaining`).

### `drawHealthBar`

Renders three layers:
1. Semi-transparent black shadow (2 px padding)
2. Dark grey background track
3. Coloured fill proportional to `percent`
4. White 2 px border stroke

### Controls Hint

A fixed text at the bottom centre of the screen lists the key bindings. Displayed at 45% alpha.
