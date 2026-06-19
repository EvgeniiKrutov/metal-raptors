# React Integration

## Overview

React wraps the Phaser canvas and provides:

- The `GameContainer` component that mounts/destroys the Phaser game instance
- The `HUD` overlay (lives outside the canvas, rendered in DOM)
- The `StartScreen` level selector
- The `GameOverScreen` overlay
- The `PauseScreen` overlay
- The `OrientationGate` rotate-to-landscape overlay (touch devices)
- The `useGame` hook that bridges Phaser events to React state

---

## Components

### `App` (`src/components/App.tsx`)

Root component. Composes `GameContainer`, `HUD`, `StartScreen`, `PauseScreen`,
`GameOverScreen`, and `OrientationGate`. The selector is shown while `!isStarted`;
the pause overlay while `isStarted && isPaused && !isGameOver`; the game-over
overlay while `isGameOver`. Passes `useGame` state and handlers down as props.

### `GameContainer` (`src/components/GameContainer.tsx`)

Mounts a `<div>` that Phaser attaches its canvas to. Creates the `Phaser.Game` instance on mount and destroys it on unmount. Calls `attachListeners()` once after the game is created so the `useGame` hook can start receiving events. The game uses `Phaser.Scale.RESIZE` so the canvas always fills the screen with no letterbox bars; see [display-and-responsiveness.md](display-and-responsiveness.md).

### `OrientationGate` (`src/components/OrientationGate.tsx`)

On touch devices, best-effort locks the screen to landscape and shows a full-screen "rotate your device" overlay while held in portrait. No-op on non-touch devices. See [display-and-responsiveness.md](display-and-responsiveness.md).

### `HUD` (`src/components/HUD.tsx`)

DOM overlay positioned absolutely over the canvas. Currently a version stamp placeholder (`v1.0`). Health bars are drawn inside `UIScene` on the Phaser canvas rather than here.

### `StartScreen` (`src/components/StartScreen.tsx`)

The level selector. Renders one button per level from `getLevels()`, each with a
✓ badge when its id is in the persisted `completed` set. Selecting a level calls
`onStart(levelId)`; buttons are disabled until `ready` (assets loaded). Also hosts
the `plane-select-entry` (Garage) button that opens the `PlaneSelector`.

### `PlaneSelector` (`src/components/PlaneSelector.tsx`)

A self-contained overlay, opened from `StartScreen`, that lets the player pick the
plane they fly — shown on the main screen only. Previews one plane at a time with
edge arrows, a Select button (disabled when already equipped), and a reserved panel
for future characteristics. The choice persists in `localStorage`. See
[plane-selector.md](plane-selector.md).

### `GameOverScreen` (`src/components/GameOverScreen.tsx`)

Shown when `isGameOver` is true. Takes `outcome`, `onRestart`, and `onExitToMenu`.

- **VICTORY** — *Continue* (`onExitToMenu` → selector) and *Restart* (`onRestart`).
- **DEFEAT** — *Restart* (`onRestart`) and *Menu* (`onExitToMenu` → selector).

### `PauseScreen` (`src/components/PauseScreen.tsx`)

Shown when the game is paused (`isStarted && isPaused && !isGameOver`). Takes
`onResume` and `onExitToMenu`.

- *Resume* (`onResume` → `resumeGame`) — emits `RESUME_GAME`; `GameScene` unfreezes both scenes.
- *Menu* (`onExitToMenu`) — reuses the standard exit path, returning to the selector and releasing the scene's resources.

The pause window is opened from the Phaser side (`ESC` → `GAME_PAUSED`); see
[scenes.md](scenes.md) for the freeze/resume mechanics.

---

## `useGame` Hook (`src/hooks/useGame.ts`)

Subscribes to `gameEvents` and exposes React-friendly state.

### Returned Values

| Value | Type | Description |
|---|---|---|
| `outcome` | `GameOutcome` | `'VICTORY'`, `'DEFEAT'`, or `null` |
| `isGameOver` | `boolean` | True after `GAME_OVER` event |
| `isPaused` | `boolean` | True after `GAME_PAUSED`; cleared on resume / exit |
| `isReady` | `boolean` | True after `ASSETS_LOADED` |
| `isStarted` | `boolean` | True once a level launches (selector hidden) |
| `playerHealth` | `{ current, max }` | Updated on `PLAYER_HEALTH_CHANGED` |
| `completed` | `string[]` | Persisted completed level ids (for ✓ badges) |
| `selectedLevelId` | `string \| null` | The level currently being played |
| `attachListeners` | `() => void` | Call once after Phaser game is created |
| `startGame` | `(levelId) => void` | Launches a level; emits `START_GAME { levelId }` |
| `restartGame` | `() => void` | Replays the current level; emits `RESTART_GAME { levelId }` |
| `resumeGame` | `() => void` | Unfreezes a paused game; emits `RESUME_GAME` |
| `exitToMenu` | `() => void` | Returns to the selector; emits `EXIT_TO_MENU` |

### Event Subscriptions (set up by `attachListeners`)

| Event | Effect |
|---|---|
| `ASSETS_LOADED` | Sets `isReady = true` |
| `GAME_OVER` | Sets `outcome` + `isGameOver`; on VICTORY, `markCompleted(levelId)` |
| `GAME_PAUSED` | Sets `isPaused = true` (shows the pause overlay) |
| `PLAYER_HEALTH_CHANGED` | Updates `playerHealth` |

### Flow handlers

- `startGame(levelId)` — `setSelectedLevelId` + `setIsStarted(true)` + emit
  `START_GAME { levelId }`. `PreloadScene` (the idle hub) catches it and starts
  `GameScene` with the level.
- `restartGame()` — clears game-over and emits `RESTART_GAME { levelId }` with the
  selected level; `GameScene.handleRestart` does `scene.restart({ levelId })`.
- `resumeGame()` — clears `isPaused` and emits `RESUME_GAME`; `GameScene.handleResume`
  unfreezes `GameScene` and `UIScene`.
- `exitToMenu()` — clears game-over and pause, `setIsStarted(false)`, emits
  `EXIT_TO_MENU`; `GameScene.handleExit` stops `UIScene` and returns to `PreloadScene`.

See [levels.md](levels.md) for completion persistence and the level data model.
