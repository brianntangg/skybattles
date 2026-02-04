// ============================================
// Sky Battles - Boot Scene
// Handles initial loading and connection
// ============================================

import Phaser from 'phaser';
import { networkManager } from '../network/NetworkManager';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Create loading bar
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    const loadingText = this.add.text(width / 2, height / 2 - 50, 'Loading...', {
      font: '20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, height / 2, '0%', {
      font: '18px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Update progress bar
    this.load.on('progress', (value: number) => {
      progressBar.clear();
      progressBar.fillStyle(0x3498db, 1);
      progressBar.fillRect(width / 2 - 150, height / 2 - 15, 300 * value, 30);
      percentText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Since we're using geometric shapes, we don't need to load any assets
    // But we'll add a small delay to show the loading screen
    this.load.image('placeholder', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Sky gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x1A5276, 0x1A5276, 1);
    bg.fillRect(0, 0, width, height);
    this.add.ellipse(150, 80, 200, 50, 0xffffff, 0.3);
    this.add.ellipse(500, 100, 180, 40, 0xffffff, 0.25);
    this.add.ellipse(800, 55, 160, 45, 0xffffff, 0.3);

    // Connect to server
    const statusText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'Connecting to server...',
      { font: '20px Arial', color: '#ffffff' }
    ).setOrigin(0.5);

    networkManager.connect()
      .then(() => {
        statusText.setText('Connected!');
        this.time.delayedCall(500, () => {
          this.scene.start('MenuScene');
        });
      })
      .catch((err) => {
        statusText.setText(`Connection failed: ${err.message}\nMake sure the server is running!`);
        statusText.setColor('#ff0000');

        // Add retry button
        const retryBtn = this.add.text(
          this.cameras.main.width / 2,
          this.cameras.main.height / 2 + 60,
          '[ RETRY ]',
          { font: '24px Arial', color: '#3498db' }
        ).setOrigin(0.5).setInteractive();

        retryBtn.on('pointerdown', () => {
          this.scene.restart();
        });

        retryBtn.on('pointerover', () => retryBtn.setColor('#ffffff'));
        retryBtn.on('pointerout', () => retryBtn.setColor('#3498db'));
      });
  }
}
