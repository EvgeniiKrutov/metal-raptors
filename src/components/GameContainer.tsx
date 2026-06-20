import React, { useEffect, useRef } from 'react';
import Phaser from 'phaser';
import VirtualJoystickPlugin from 'phaser3-rex-plugins/plugins/virtualjoystick-plugin.js';
import { BootScene }    from '../game/scenes/BootScene';
import { PreloadScene } from '../game/scenes/PreloadScene';
import { GameScene }    from '../game/scenes/GameScene';
import { UIScene }      from '../game/scenes/UIScene';

interface Props {
  onReady: () => void;
}

const GameContainer: React.FC<Props> = ({ onReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef      = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      backgroundColor: '#87ceeb',
      render: {
        pixelArt: true,
        antialias: false,
        roundPixels: false,
      },
      scale: {
        mode:          Phaser.Scale.RESIZE,
        autoCenter:    Phaser.Scale.CENTER_BOTH,
        width:         window.innerWidth,
        height:        window.innerHeight,
        parent:        containerRef.current,
      },
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { x: 0, y: 0 },
          fixedStep: true,
          fps: 60,
          debug: import.meta.env.DEV && false, // set true to see hitboxes
        },
      },
      scene: [BootScene, PreloadScene, GameScene, UIScene],
      plugins: {
        scene: [
          {
            key:     'rexVirtualJoystick',
            plugin:  VirtualJoystickPlugin,
            mapping: 'rexVirtualJoystick',
          },
        ],
      },
      parent: containerRef.current,
    };

    gameRef.current = new Phaser.Game(config);

    // Notify parent that Phaser is initialised
    gameRef.current.events.once('ready', () => onReady());

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      id="phaser-container"
      ref={containerRef}
      style={{ width: '100%', height: '100%' }}
    />
  );
};

export default GameContainer;
