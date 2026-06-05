# Metal Raptors ✈

> 2D Retro Pixel-Art Arcade Dogfight — MVP

## Quick Start

```bash
npm install
npm run dev          # opens http://localhost:3000
```

## Controls

| Key | Action |
|-----|--------|
| **W** | Throttle (accelerate) |
| **S** | Brake (decelerate) |
| **A** | Rotate counter-clockwise |
| **D** | Rotate clockwise |
| **F** | Fire (hold for auto-fire) |

## Tech Stack

| Technology | Role |
|------------|------|
| **Phaser 3** | Game engine, arcade physics, rendering |
| **React 18** | UI wrapper, game-over screen, event bridge |
| **TypeScript** | Type safety |
| **Vite** | Dev server & build tool |
| **Tailwind CSS** | Overlay styling |

## Project Structure

```
src/
├── components/        # React components (App, GameContainer, HUD, GameOverScreen)
├── hooks/             # useGame — subscribes to Phaser game events
├── types/             # Shared TypeScript interfaces
├── styles/            # Global CSS
└── game/
    ├── config/        # gameConfig.ts  (reads all VITE_* env vars)
    ├── entities/      # Plane, PlayerPlane, EnemyPlane, Bullet
    ├── scenes/        # BootScene, PreloadScene, GameScene, UIScene
    ├── systems/       # PhysicsSystem, ParallaxSystem, CombatSystem
    ├── utils/         # helpers.ts
    └── Game.ts        # Shared gameEvents EventEmitter
```

## Flight Physics

```
Lift     = speed × liftCoeff × |cos(angle)|
Gravity  = gravity × weight
vDrift  += (gravity − lift) × dt   [accumulated each frame]
velocity = (speed·cos θ,  speed·sin θ + vDrift)
```

**Stall**: speed < `VITE_STALL_SPEED` → lift insufficient → nose pitches down.  
**Recovery**: hold **W** to regain speed and lift.

## Configuration

All constants live in `.env`.  Copy `.env.example` → `.env` and tweak:

```
VITE_GRAVITY=800
VITE_LIFT_COEFFICIENT=1.5
VITE_STALL_SPEED=80
VITE_PLAYER_MAX_SPEED=500
VITE_PLAYER_HEALTH=100
VITE_ENEMY_HEALTH=100
# ... see .env for the full list
```

## Adding Real Assets

Replace `make*Texture()` calls in `PreloadScene.ts` with actual `this.load.image(key, url)` calls.  
Audio triggers are stubbed in `GameScene`— add `this.load.audio(...)` in `PreloadScene` and call `this.sound.play(key)` where indicated.

## Win / Lose Conditions

| Condition | Outcome |
|-----------|---------|
| Enemy health → 0 | **Victory** |
| Player hits the ground | **Defeat** |

## Roadmap

- [ ] Enemy AI (Phase 2)
- [ ] Enemy shooting at player
- [ ] Mobile touch controls (Phase 3)
- [ ] Multiplayer via WebSocket (Phase 4)
- [ ] Particle effects, screen shake, music (Phase 6)
