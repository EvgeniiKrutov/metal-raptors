import { GameConfigData } from '../../types/game.types';
import playerJson  from './data/player.json';
import bulletJson  from './data/bullet.json';
import bombJson    from './data/bomb.json';
import physicsJson from './data/physics.json';
import worldJson   from './data/world.json';
import spawnJson   from './data/spawn.json';

export const gameConfig: GameConfigData = {
  display:  worldJson.display,
  world:    worldJson.world,
  camera:   worldJson.camera,
  parallax: worldJson.parallax,
  physics:  physicsJson,
  player:   playerJson,
  bullet:   bulletJson,
  bomb:     bombJson,
  spawn:    spawnJson,
  enemy: {
    sprite:    'enemy',
    width:     64,
    maxSpeed:  0,
    turnSpeed: 0,
    mass:      1.0,
    health:    100,
    damage:    10,
    fireRate:  5,
  },
};
