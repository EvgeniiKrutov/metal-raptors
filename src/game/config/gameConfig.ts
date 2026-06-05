import { GameConfigData } from '../../types/game.types';
import playerJson  from './data/player.json';
import bulletJson  from './data/bullet.json';
import physicsJson from './data/physics.json';
import worldJson   from './data/world.json';

export const gameConfig: GameConfigData = {
  display:  worldJson.display,
  world:    worldJson.world,
  camera:   worldJson.camera,
  parallax: worldJson.parallax,
  physics:  physicsJson,
  player:   playerJson,
  bullet:   bulletJson,
  enemy: {
    sprite:       'enemy',
    width:        64,
    maxSpeed:     0,
    minSpeed:     0,
    acceleration: 0,
    braking:      0,
    turnSpeed:    0,
    weight:       1.0,
    health:       100,
    damage:       10,
    fireRate:     5,
  },
};
