import Phaser from 'phaser';
import { Plane } from '../entities/Plane';

export class PhysicsSystem {
  static updateFlight(plane: Plane): void {
    const body = plane.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(
      plane.currentSpeed * Math.cos(plane.rotation),
      plane.currentSpeed * Math.sin(plane.rotation),
    );
  }
}
