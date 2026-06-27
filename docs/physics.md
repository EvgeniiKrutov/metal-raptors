# Flight Physics

Implemented in `src/game/systems/PhysicsSystem.ts` as a stateless utility (`PhysicsSystem.updateFlight`). Arcade gravity is disabled globally; the only force applied is forward thrust.

Arcade Physics runs on a **fixed timestep** (`physics.arcade.fixedStep: true`, `fps` in the Phaser config), so body integration is deterministic and frame-rate independent. Rendering is decoupled from this simulation by the [InterpolationSystem](systems.md#interpolationsystem), which interpolates the *drawn* position of moving sprites between fixed steps without ever moving the physics body — so the hitboxes described here are unaffected. `roundPixels` is off in the render config and on the camera so the interpolated sub-pixel positions are preserved.

## Constant-speed flight

Every plane always flies forward at a constant speed: `currentSpeed` is fixed to `maxSpeed` (from config) at spawn and never changes. There is no throttle, no gravity, no lift, and no stall — planes do not fall. Each fixed step the body velocity is set purely from the plane's heading:

```
vx = currentSpeed × cos(rotation)
vy = currentSpeed × sin(rotation)
```

`rotation` is the plane's heading in radians (0 = facing right, π/2 = facing down). Steering the plane therefore changes only its *direction* of travel, never its speed.

## Mass-based turning

Heading is no longer changed instantly. Each plane carries an `angularVelocity` (rad/s) that is smoothed toward a desired turn rate so heavier planes feel sluggish to redirect but can still complete a full rotation. Two helpers on `Plane` drive this:

- `applyTurnRate(desiredRate, dt)` — eases `angularVelocity` toward `desiredRate`, then advances `rotation`:

  ```
  approach        = 1 − exp(−(turnResponsiveness / mass) × dt)
  angularVelocity += (desiredRate − angularVelocity) × approach
  rotation        += angularVelocity × dt
  ```

  The approach rate is `turnResponsiveness / mass` (per second): a higher `mass` means a longer time-constant, i.e. more inertia and a smoother, delayed response.

- `steerToHeading(targetHeading, dt)` — derives a desired turn rate from the angle error (clamped to the plane's max turn rate `turnSpeed`) and forwards it to `applyTurnRate`. The combination makes a plane *follow* a target heading with a slight lag rather than snapping to it.

| Caller | Desired turn rate |
|---|---|
| Player — keyboard `A`/`D` | `±turnSpeed` while held, `0` otherwise (heading coasts via inertia) |
| Player — touch joystick | `steerToHeading(joystickDirection)` — the plane follows the finger with a slight delay |
| Enemy AI | `steerToHeading(desiredHeading)` from the AI state machine |

## Configuration

| Source | Key | Description |
|---|---|---|
| `physics.json` | `turnResponsiveness` | Global base responsiveness of the turn-rate smoothing (per second). Effective approach rate is `turnResponsiveness / mass`. |
| Per-plane config | `mass` | Turn inertia. Higher = heavier, smoother, slower to change heading. |
| Per-plane config | `turnSpeed` | Maximum turn rate (deg/s). |
| Per-plane config | `maxSpeed` | Constant forward speed (px/s). |
