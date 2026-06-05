# React Integration

## Overview

React wraps the Phaser canvas and provides:

- The `GameContainer` component that mounts/destroys the Phaser game instance
- The `HUD` overlay (lives outside the canvas, rendered in DOM)
- The `GameOverScreen` overlay
- The `useGame` hook that bridges Phaser events to React state

---

## Components

### `App` (`src/components/App.tsx`)

Root component. Composes `GameContainer`, `HUD`, and `GameOverScreen`. Passes `useGame` state down as props.

### `GameContainer` (`src/components/GameContainer.tsx`)

Mounts a `<div>` that Phaser attaches its canvas to. Creates the `Phaser.Game` instance on mount and destroys it on unmount. Calls `attachListeners()` once after the game is created so the `useGame` hook can start receiving events.

### `HUD` (`src/components/HUD.tsx`)

DOM overlay positioned absolutely over the canvas. Currently a version stamp placeholder (`v1.0`). Health bars are drawn inside `UIScene` on the Phaser canvas rather than here.

### `GameOverScreen` (`src/components/GameOverScreen.tsx`)

Shown when `isGameOver` is true. Displays the outcome (`VICTORY` / `DEFEAT`) and a restart button that calls `restartGame()`.

---

## `useGame` Hook (`src/hooks/useGame.ts`)

Subscribes to `gameEvents` and exposes React-friendly state.

### Returned Values

| Value | Type | Description |
|---|---|---|
| `outcome` | `GameOutcome` | `'VICTORY'`, `'DEFEAT'`, or `null` |
| `isGameOver` | `boolean` | True after `GAME_OVER` event |
| `playerHealth` | `{ current, max }` | Updated on `PLAYER_HEALTH_CHANGED` |
| `enemyHealth` | `{ current, max }` | Updated on `ENEMY_HEALTH_CHANGED` |
| `attachListeners` | `() => void` | Call once after Phaser game is created |
| `restartGame` | `() => void` | Resets state and emits `RESTART_GAME` |

### Event Subscriptions (set up by `attachListeners`)

| Event | Effect |
|---|---|
| `GAME_OVER` | Sets `outcome` and `isGameOver = true` |
| `PLAYER_HEALTH_CHANGED` | Updates `playerHealth` |
| `ENEMY_HEALTH_CHANGED` | Updates `enemyHealth` |

### `restartGame`

Resets `isGameOver` to `false` and `outcome` to `null`, then emits `RESTART_GAME` on `gameEvents`. `GameScene` listens for this event once (`.once`) and calls `scene.restart()`.
