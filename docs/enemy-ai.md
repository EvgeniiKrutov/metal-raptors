# Enemy AI

Enemy AI is split across `src/game/entities/`:

- `EnemyPlane.ts` — abstract base class with shared helpers: ground-avoidance checks, recover heading, lead-intercept prediction, and firing (`updateFiring` emits `fire` with the enemy's own `stats.damage`).
- `FighterPlane.ts` — dogfighting behavior (`role: "fighter"`).
- `KamikazePlane.ts` — suicide attacker (`role: "kamikaze"`).
- `HeavyPlane.ts` — heavy gunship (`role: "heavy"`).
- `createEnemyPlane.ts` — factory that picks the class from the behavior config's `role` field.

Behavior configs live in `src/game/config/data/enemies/*.json` and are referenced by `id` from level stage configs. Every config shares `stats`, `flight`, and `ai.groundAvoidance`; the rest of the `ai` block is role-specific (see the `EnemyBehaviorConfig` union in `src/types/game.types.ts`).

# Fighter

The fighter runs a four-state machine updated every frame via `updateAI(delta, ctx)`.

## States

```
          ground threat
  any state ──────────────→ RECOVER
                                │ altitude >= safeAltitudeMargin
                                ↓
          off-screen        ATTACK ◄──────────────────────────────┐
  any state ──────────→ RETURN    │                               │
              on-screen ↓    timer│expires (no hit)  hit received │
                        ATTACK    ↓                  ↓            │
                          ┌─────  FLY              EVADE          │
                          │        │  timer expires   │           │
                          └────────┘                  └───────────┘
```

### RECOVER (highest priority)
- **Trigger:** altitude < `minAltitudeMargin`
- **Behaviour:** smooth nose-up climb in the current horizontal direction (biased 70° upward)
- **Fires** constantly while climbing
- **Exit:** altitude >= `safeAltitudeMargin` → ATTACK

### RETURN (second priority)
- **Trigger:** enemy sprite is outside the camera's visible world rectangle
- **Behaviour:** flies directly toward the player's current position; no firing, no weave
- **Exit:** enemy re-enters camera view → ATTACK (starts a fresh attack cycle)
- **Note:** RECOVER takes priority over RETURN — if the enemy is also near the ground while off-screen it will climb first

### ATTACK
- **Behaviour:** flies toward the lead-intercept point; shoots when aligned
- **Exit (no hit):** after `attackDurationMs` → FLY
- **Exit (hit):** immediately → EVADE
- **Exit (ground):** → RECOVER

### FLY
- **Behaviour:** repositioning break — climbs to `targetYFactor × groundY`, weaves horizontally with a sine wave. No player tracking, no firing.
- **Exit (no hit):** after `flyDurationMs` → ATTACK
- **Exit (hit):** immediately → EVADE
- **Exit (ground):** → RECOVER

### EVADE
- **Trigger:** enemy takes a hit while in ATTACK or FLY
- **Behaviour:** flies away from the player's position at entry; adds random jitter to heading at `jitterHz`
- **Note:** additional hits during EVADE do **not** extend the timer
- **Exit:** after `evadeDurationMs` → ATTACK

## Lead Intercept (Predictive Aiming)

The enemy computes a velocity-based intercept point rather than aiming at the player's current position. The algorithm iterates twice to converge:

```
t₀ = 0
for i in 0..1:
    d = distance(enemy, target + velocity × t × leadFactor)
    t = d / bulletSpeed
aim = target + velocity × t × leadFactor
```

`leadFactor` (from the JSON config) scales how aggressively the enemy leads the target (1.0 = exact intercept).

## Firing Conditions

The enemy fires only when **all** of the following are true:

1. Not in FLY state
2. Target (player) is inside the camera view (`targetVisible = true`)
3. Distance to target ≤ `maxFireRange`
4. Aiming error ≤ `fireAngleThreshold` (degrees)
5. Fire cooldown has elapsed (`1000 / fireRate` ms)

## Weave Pattern (FLY state)

```
weaveX = flyBaseX + sin(flyWeaveT × 2π × weaveHz) × weaveAmplitude
heading = angle_to(weaveX, groundY × targetYFactor)
```

`flyBaseX` is the player's X position recorded at FLY entry, giving the enemy a fixed weave origin rather than chasing the target.

## Configuration Keys (`enemies/fighter.json`)

### `ai.targeting`
| Key | Description |
|---|---|
| `fireAngleThreshold` | Max aiming error in degrees before firing |
| `leadFactor` | Intercept lead multiplier (1 = exact) |
| `maxFireRange` | Max engagement distance (px) |

### `ai.groundAvoidance`
| Key | Description |
|---|---|
| `minAltitudeMargin` | Altitude that triggers RECOVER (px from ground) |
| `safeAltitudeMargin` | Altitude that exits RECOVER (px from ground) |

### `ai.attack`
| Key | Description |
|---|---|
| `durationMs` | Time in ATTACK before switching to FLY (ms) |

### `ai.fly`
| Key | Description |
|---|---|
| `durationMs` | Time in FLY before returning to ATTACK (ms) |
| `targetYFactor` | Target height as fraction of groundY (0=top, 1=ground) |
| `weaveAmplitude` | Horizontal weave amplitude (px) |
| `weaveHz` | Weave frequency (Hz) |

### `ai.evasion`
| Key | Description |
|---|---|
| `durationMs` | Time in EVADE (ms) |
| `jitterAmplitude` | Max random heading offset per tick (radians) |
| `jitterHz` | How often jitter is re-randomised (Hz) |
| `threatRadius` | Bullet detection radius (px) |
| `threatMissDistance` | Perpendicular miss distance threshold (px) |

# Kamikaze

Fast, fragile suicide plane (`enemies/kamikaze.json`, Albatros D.III sprite). It never shoots; it detonates instead.

## Spawning

Unlike other enemies, which spawn at a random angle on the off-screen ring around the player, the kamikaze spawns in the direction the player's nose is pointing (`player.rotation` plus a random offset within `±ai.spawn.angleJitterDeg`). It therefore always enters the screen in front of the player's guns, giving the player time to react and shoot it down before it closes in. Both `LevelManager` and `BattlefieldLevelManager` apply this rule in their spawn-angle computation.

## States

```
  any state ── ground threat ──→ RECOVER ── safe altitude ──→ PURSUE
  any state ── off-screen ─────→ RETURN  ── on-screen ──────→ PURSUE
  PURSUE  ── pursue timer expires ──→ BREAK_OFF
  BREAK_OFF ── break-off timer expires ──→ PURSUE
  any state ── player within triggerRadius ──→ DETONATE (terminal)
```

- **PURSUE** — flies straight at the player with a sinusoidal heading weave (`weaveAmplitudeDeg` / `weaveHz`) that makes it harder to hit.
- **BREAK_OFF** — after `pursue.durationMs` without reaching the player it turns away: heading directly away from the player plus a random offset within `±headingJitterDeg`, held for `breakOff.durationMs`, then it attacks again.
- **DETONATE** — checked every frame before anything else. When the distance to the player drops below `blast.triggerRadius`, the plane emits `detonate`; the scene spawns an air explosion sized to the blast, removes the plane, and applies `stats.damage` to the player if the player is inside `blast.damageRadius`. Both radii are multiplied by the plane's current scale, so they shrink correctly on the battlefield map.

Shooting the kamikaze down before it reaches you triggers a normal (harmless) kill explosion. It performs no evasion when damaged — its defense is speed and the weave.

## Configuration Keys (`enemies/kamikaze.json`)

### `ai.spawn`
| Key | Description |
|---|---|
| `angleJitterDeg` | Random spread around the player's nose direction for the spawn angle (degrees) |

### `ai.pursue`
| Key | Description |
|---|---|
| `durationMs` | Time chasing the player before breaking off (ms) |
| `weaveAmplitudeDeg` | Max heading weave offset while pursuing (degrees) |
| `weaveHz` | Weave frequency (Hz) |

### `ai.breakOff`
| Key | Description |
|---|---|
| `durationMs` | Time flying away before the next attack run (ms) |
| `headingJitterDeg` | Random spread applied to the escape heading (degrees) |

### `ai.blast`
| Key | Description |
|---|---|
| `triggerRadius` | Distance to the player that triggers detonation (px) |
| `damageRadius` | Radius inside which the player takes `stats.damage` (px) |

# Heavy

Slow, tanky gunship modelled on the Fokker Eindecker (`enemies/heavy.json`). High health and mass, very low turn speed, higher bullet damage, and a faster fire rate than the fighter.

## States

```
  any state ── ground threat ──→ RECOVER ── safe altitude ──→ PASS
  any state ── off-screen ─────→ RETURN  ── on-screen ──────→ PASS
```

- **PASS** — the core behavior. The heavy never turns around to chase the player. It keeps its current horizontal direction; when the player is ahead of it, it steers toward the lead-intercept point but clamps its climb/dive to `±maxClimbAngleDeg` from horizontal. When the player is behind, it levels out and keeps flying toward the screen edge — the world wraps horizontally, so it reappears on the opposite side and lines up another straight pass.
- It fires whenever aligned during PASS, using its own wider `fireAngleThreshold` and longer `maxFireRange`.
- It does not evade when hit; it absorbs damage and holds course.

## Configuration Keys (`enemies/heavy.json`)

### `ai.pass`
| Key | Description |
|---|---|
| `maxClimbAngleDeg` | Max deviation from level flight while approaching (degrees) |

`ai.targeting` and `ai.groundAvoidance` use the same keys as the fighter.
