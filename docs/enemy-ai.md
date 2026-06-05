# Enemy AI

Implemented in `src/game/entities/EnemyPlane.ts`. The AI runs a four-state machine updated every frame via `updateAI(delta, ctx)`.

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
