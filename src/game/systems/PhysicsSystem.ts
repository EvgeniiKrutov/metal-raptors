import { Plane } from '../entities/Plane';
import { gameConfig } from '../config/gameConfig';
import { clamp } from '../utils/helpers';

export class PhysicsSystem {
  static updateFlight(plane: Plane, delta: number, isThrottlingUp: boolean = false): void {
    const dt   = delta / 1000;
    const phys = gameConfig.physics;
    const cfg  = plane.planeConfig;

    const angle = plane.rotation;

    const lift = plane.currentSpeed * phys.liftCoefficient * Math.abs(Math.cos(angle));

    const isStalling = plane.currentSpeed < phys.stallSpeed;
    if (isStalling) {
      if (isThrottlingUp && plane.rotation > 0) {
        plane.rotation -= phys.stallRotationRate * dt * 0.5;
      } else if (!isThrottlingUp) {
        plane.rotation += phys.stallRotationRate * dt;
      }
    }

    const netVertical = phys.gravity * cfg.weight - lift;
    plane.verticalDrift += netVertical * dt;

    plane.verticalDrift = clamp(plane.verticalDrift, -1200, 1200);

    if (!isStalling && Math.abs(plane.verticalDrift) > 0) {
      plane.verticalDrift *= Math.pow(0.97, delta / 16.67);
    }

    const thrustX = plane.currentSpeed * Math.cos(angle);
    const thrustY = plane.currentSpeed * Math.sin(angle);

    const body = plane.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(thrustX, thrustY + plane.verticalDrift);
  }
}
