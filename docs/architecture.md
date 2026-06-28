# Architecture Overview

## Tech Stack

- **Phaser 3** — game engine (physics, scenes, input, rendering)
- **React** — UI shell (HUD overlay, game-over screen)
- **Vite** — build tool
- **TypeScript** — throughout
- **Capacitor 8** — native iOS shell + custom native plugins

## React + Phaser Integration

React owns the outer DOM shell; Phaser renders into a `<canvas>` element mounted by the `GameContainer` component. Communication between the two worlds is event-driven via a shared singleton `EventEmitter` (`src/game/Game.ts`).

```
React (UI layer)
   ↕  gameEvents (EventEmitter)
Phaser (game loop)
```

Scenes emit events; React components subscribe to them via the `useGame` hook. React triggers game actions (e.g. restart) by emitting events back onto `gameEvents`.

The canvas fills the screen with no letterbox bars and adapts to any device (desktop + mobile) via `Phaser.Scale.RESIZE`, a screen-height-driven camera zoom, an edge-anchored responsive HUD, and a landscape orientation gate — see [display-and-responsiveness.md](display-and-responsiveness.md).

## Services Layer & Capacitor-Native Boundary

`src/services/` holds modules that bridge React to platform/native capabilities,
isolating Capacitor and native plugins from the rest of the app. The first such
module, `gameCenter.ts`, wraps the custom Swift `GameCenter` Capacitor plugin
(`ios/App/App/plugins/GameCenter/`) and centralizes the platform guard, dev mock,
timeout, and result shape. UI code calls `authenticateGameCenter()` and never
touches Capacitor directly. See [gamecenter.md](gamecenter.md).

## Scene Pipeline

```
BootScene → PreloadScene ─┬─ GameScene         (Air Fights)
                          └─ BattlefieldScene  (Battlefield)
                               ↕ (parallel)
                           UIScene
```

| Scene | Responsibility |
|---|---|
| `BootScene` | Immediately transitions to `PreloadScene` |
| `PreloadScene` | Loads generic assets; generates runtime textures; idle hub that resolves `START_GAME { levelId }` to the level's scene key and launches it |
| `GameScene` | Air-level gameplay loop — player, `LevelManager`, physics, AI, combat, camera; loads the level's backgrounds in `preload` |
| `BattlefieldScene` | Battlefield gameplay loop — side-scrolling map, curved ground (`TerrainSystem`), enemy planes + ground machines; see [battlefield.md](battlefield.md) |
| `UIScene` | Parallel HUD overlay — health bars + stage indicator drawn with `Graphics` |

The level → scene routing is driven by the **section registry**
(`data/sections.ts`, `getSceneKeyForLevel`). See [battlefield.md](battlefield.md).

## Data-Driven Design

Enemy archetypes are fully described by JSON files under
`src/game/config/data/enemies/`, and **levels** by JSON under
`src/game/config/data/levels/`. A level lists ordered stages, each spawning a
quota of enemy types; the `LevelManager` system drives spawning and stage
progression. Swapping JSON changes enemies, backgrounds, and level structure
without touching TypeScript. See [levels.md](levels.md).

## Event Bus

`src/game/Game.ts` exports two things:

- `gameEvents` — the shared `Phaser.Events.EventEmitter` instance
- `EVENTS` — string constants for all event names

| Event | Direction | Payload |
|---|---|---|
| `ASSETS_LOADED` | Phaser → React | — |
| `START_GAME` | React → Phaser | `{ levelId }` |
| `GAME_STARTED` | Phaser → React | — |
| `GAME_OVER` | Phaser → React | `{ outcome: 'VICTORY' \| 'DEFEAT', levelId }` |
| `RESTART_GAME` | React → Phaser | `{ levelId }` |
| `EXIT_TO_MENU` | React → Phaser | — |
| `PLAYER_HEALTH_CHANGED` | Phaser → React | `{ current, max }` |

## Registry (Phaser → UIScene)

`GameScene` writes the live enemy descriptors (`enemies` — an array of
`{ screenX, screenY, percent }`), the player health, and a `stageInfo` object
into the Phaser registry each frame. `UIScene` reads them in its `update()` to
draw the per-enemy floating health bars and the stage indicator without needing a
direct scene reference.
