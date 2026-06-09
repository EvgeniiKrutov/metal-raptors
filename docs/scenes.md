# Scenes

## BootScene

`src/game/scenes/BootScene.ts`

The very first scene Phaser starts. Has no assets to preload; immediately transitions to `PreloadScene` in `create()`.

---

## PreloadScene

`src/game/scenes/PreloadScene.ts`

Loads all image assets and generates runtime textures before the game starts.

### Asset Loading

| Key | File |
|---|---|
| `player_temp` | `sprites/planes/Sopwith_Camel.png` |
| `enemy_temp` | `sprites/planes/Fokker_Dr_1.png` |
| `bg` | `backgrounds/verden/Verden_Background_Dawn.png` |
| `fg` | `backgrounds/verden/Verden_Foreground_Dawn.png` |
| `ground` | `backgrounds/verden/Verden_Ground_Dawn.png` |

### Texture Generation

After loading, three textures are generated programmatically and stored in the Phaser texture cache:

**`player` / `enemy`** — Built from the loaded sprites via `RenderTexture`. Both are scaled to a base width of 130 px with the aspect ratio preserved. The enemy texture is flipped vertically (`setFlipY(true)`).

**`bullet`** — A `width × height` gold rectangle (from `bullet.json`) with a 2 px white leading edge to suggest motion direction.

### Loading UI

A progress bar and title text are shown during asset loading. The bar width tracks the `progress` event; the loading text updates per-file via the `fileprogress` event.

---

## GameScene

`src/game/scenes/GameScene.ts`

Main gameplay scene. Owns all game entities and drives the per-frame update loop.

### Setup (`create`)

1. Physics world bounds set to `world.width × world.height`; arcade gravity disabled
2. `InterpolationSystem` created (render-interpolation hooks for smooth high-refresh motion); `ParallaxSystem` created and background layers added
3. Ground visual: a tile sprite at `worldHeight − 80` with depth −50
4. Bullet pools created: player bullets (max 120) and enemy bullets (max 120)
5. `PlayerPlane` spawned at 20% × 45% of world size
6. `EnemyPlane` spawned at 75% × 45% with the fighter behavior JSON
7. Player, enemy (and each spawned bullet) registered with the `InterpolationSystem`
8. Camera follows the player with configurable lerp (round-pixels disabled so interpolated sub-pixel positions are not re-quantized); bounds set to the full world
9. WASD + F keys registered
10. `CombatSystem` initialised
11. Health values written to the registry; `UIScene` launched in parallel
12. `RESTART_GAME` listener registered; `GAME_STARTED` event emitted

### Update Loop

`update` runs between the `InterpolationSystem`'s `preupdate` hook (which restores every sprite to its authoritative simulation position) and the physics step, so all positions read below are the true, non-interpolated values. Position interpolation for rendering is reapplied afterwards in `postupdate`.

Each frame (when not game over):

1. **Player input & physics** — `handleInput` → `updatePhysics`
2. **Enemy AI** — player visibility and enemy visibility checks, then `updateAI`
3. **Screen wrap** — player wraps left↔right
4. **Ceiling boundary** — player clamped to Y ≥ 20; upward drift zeroed
5. **Ground collision** — player Y ≥ `groundY` triggers DEFEAT
6. **Bullet culling** — bullets outside the camera view + margin (64 px) are deactivated; enemy bullets also die on hitting the ground
7. **Combat** — `CombatSystem` checks collisions; health events emitted; death conditions checked
8. **Registry update** — enemy screen position written for `UIScene`
9. **Parallax update**

### Bullet Culling Detail

Bullets are culled against the camera's visible world rectangle expanded by 64 px on each side. This keeps a bullet alive just past the screen edge so it doesn't visibly pop out. Enemy bullets additionally die when `bullet.y >= groundY`.

### Game Over

`triggerGameOver(outcome)` is called with `'VICTORY'` or `'DEFEAT'`. A 300 ms delay is used before pausing the scene and emitting `GAME_OVER`, giving hit effects time to play out. The flag `isGameOver` prevents re-entry.

---

## UIScene

`src/game/scenes/UIScene.ts`

A parallel scene rendered on top of `GameScene`. Draws health bars each frame using `Phaser.GameObjects.Graphics`.

### Player Health Bar

Fixed to the top-left corner:
- Position: (60, 20), size: 220 × 22
- Colour: `healthColour(percent)` — green above 60%, yellow above 30%, red below

### Enemy Health Bar

Floats 44 px above the enemy's screen position (read from the registry). Width 120 px, always crimson (`0xdc143c`). Hidden when the enemy is more than 200 px off-screen horizontally.

### `drawHealthBar`

Renders three layers:
1. Semi-transparent black shadow (2 px padding)
2. Dark grey background track
3. Coloured fill proportional to `percent`
4. White 2 px border stroke

### Controls Hint

A fixed text at the bottom centre of the screen lists the key bindings. Displayed at 45% alpha.
