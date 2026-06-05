# Flight Physics

Implemented in `src/game/systems/PhysicsSystem.ts` as a stateless utility (`PhysicsSystem.updateFlight`). Arcade gravity is disabled globally; all forces are applied manually.

## Forces

| Force | Formula | Notes |
|---|---|---|
| Thrust | `currentSpeed × (cos θ, sin θ)` | Speed in the plane's facing direction |
| Lift | `currentSpeed × liftCoefficient × \|cos θ\|` | Max at horizontal flight (θ=0°), zero when pointing straight up/down |
| Gravity | `gravity × weight` | Constant downward acceleration |

`θ` is the plane's rotation in radians (0 = facing right, π/2 = facing down).

## Vertical Drift

`verticalDrift` accumulates the net vertical force each frame:

```
netVertical = gravity × weight − lift
verticalDrift += netVertical × dt
```

- `netVertical > 0` → plane falls (gravity wins)
- `netVertical < 0` → plane climbs (lift wins, rare at low speed)

Drift is capped at ±1200 px/s (terminal velocity). When not stalling and moving fast, drift decays toward zero with a frame-rate-independent exponential: `verticalDrift × 0.97^(delta/16.67)`.

Final velocity applied to the physics body:

```
vx = currentSpeed × cos(rotation)
vy = currentSpeed × sin(rotation) + verticalDrift
```

## Stall

When `currentSpeed < stallSpeed` (from `physics.json`), the plane stalls:

- Lift cannot counteract gravity.
- If the player is **throttling up** and the nose is pitched up (`rotation > 0`), rotation decreases at half the stall rate (attempted recovery).
- Otherwise the nose pitches downward at `stallRotationRate × dt`.

**Recovery:** throttle up (`W`) to regain speed and lift.

## Configuration

Physics constants live in `src/game/config/data/physics.json`:

| Key | Description |
|---|---|
| `gravity` | Downward acceleration (px/s²) |
| `dragCoefficient` | Speed decay per frame when no throttle input |
| `liftCoefficient` | Scales lift relative to speed |
| `stallSpeed` | Speed below which stall begins (px/s) |
| `stallRotationRate` | Nose-pitch rate during stall (rad/s) |
