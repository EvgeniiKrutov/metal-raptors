# Architecture Overview

## Tech Stack

- **Phaser 3** — game engine (physics, scenes, input, rendering)
- **React** — UI shell (HUD overlay, game-over screen)
- **Vite** — build tool
- **TypeScript** — throughout

## React + Phaser Integration

React owns the outer DOM shell; Phaser renders into a `<canvas>` element mounted by the `GameContainer` component. Communication between the two worlds is event-driven via a shared singleton `EventEmitter` (`src/game/Game.ts`).

```
React (UI layer)
   ↕  gameEvents (EventEmitter)
Phaser (game loop)
```

Scenes emit events; React components subscribe to them via the `useGame` hook. React triggers game actions (e.g. restart) by emitting events back onto `gameEvents`.

The canvas fills the screen with no letterbox bars and adapts to any device (desktop + mobile) via `Phaser.Scale.RESIZE`, a screen-height-driven camera zoom, an edge-anchored responsive HUD, and a landscape orientation gate — see [display-and-responsiveness.md](display-and-responsiveness.md).

## Scene Pipeline

```
BootScene → PreloadScene → GameScene
                               ↕ (parallel)
                           UIScene
```

| Scene | Responsibility |
|---|---|
| `BootScene` | Immediately transitions to `PreloadScene` |
| `PreloadScene` | Loads generic assets; generates runtime textures; idle hub that launches `GameScene` on `START_GAME { levelId }` |
| `GameScene` | Main gameplay loop — player, `LevelManager`, physics, AI, combat, camera; loads the level's backgrounds in `preload` |
| `UIScene` | Parallel HUD overlay — health bars + stage indicator drawn with `Graphics` |

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
