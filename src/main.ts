// ============================================
// Sky Battles - Main Entry Point
// Initializes Phaser game with all scenes
// ============================================

import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../shared/constants';
import { BootScene } from './scenes/BootScene';
import { MenuScene } from './scenes/MenuScene';
import { LobbyScene } from './scenes/LobbyScene';
import { LoadoutScene } from './scenes/LoadoutScene';
import { GameScene } from './scenes/GameScene';

// Phaser game configuration
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#5ba3d9',
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  },
  scene: [BootScene, MenuScene, LobbyScene, LoadoutScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

// Create and export the game instance
export const game = new Phaser.Game(config);
