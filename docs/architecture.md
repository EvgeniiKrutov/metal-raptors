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

## Scene Pipeline

```
BootScene → PreloadScene → GameScene
                               ↕ (parallel)
                           UIScene
```

| Scene | Responsibility |
|---|---|
| `BootScene` | Immediately transitions to `PreloadScene` |
| `PreloadScene` | Loads image assets; generates runtime textures (player, enemy, bullet); starts `GameScene` |
| `GameScene` | Main gameplay loop — entities, physics, AI, combat, camera |
| `UIScene` | Parallel HUD overlay — health bars drawn with `Graphics` |

## Data-Driven Design

Enemy archetypes are fully described by JSON files under `src/game/config/data/enemies/`. Swapping the JSON file changes the enemy's flight envelope, combat stats, and all AI tuning without touching TypeScript. The `EnemyBehaviorConfig` interface enforces the shape.

## Event Bus

`src/game/Game.ts` exports two things:

- `gameEvents` — the shared `Phaser.Events.EventEmitter` instance
- `EVENTS` — string constants for all event names

| Event | Direction | Payload |
|---|---|---|
| `GAME_STARTED` | Phaser → React | — |
| `GAME_OVER` | Phaser → React | `{ outcome: 'VICTORY' \| 'DEFEAT' }` |
| `RESTART_GAME` | React → Phaser | — |
| `PLAYER_HEALTH_CHANGED` | Phaser → React | `{ current, max }` |
| `ENEMY_HEALTH_CHANGED` | Phaser → React | `{ current, max }` |

## Registry (Phaser → UIScene)

`GameScene` writes live enemy position and health values into the Phaser registry each frame. `UIScene` reads them in its `update()` to position the floating enemy health bar without needing a direct scene reference.
