// ============================================
// Sky Battles - Menu Scene
// Main menu with create/join options
// ============================================

import Phaser from 'phaser';
import { networkManager } from '../network/NetworkManager';

export class MenuScene extends Phaser.Scene {
  private nameInput: HTMLInputElement | null = null;
  private codeInput: HTMLInputElement | null = null;
  private lastName: string = `Player${Math.floor(Math.random() * 1000)}`;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Sky gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x1A5276, 0x1A5276, 1);
    bg.fillRect(0, 0, width, height);
    this.add.ellipse(120, 70, 220, 55, 0xffffff, 0.35);
    this.add.ellipse(450, 110, 170, 40, 0xffffff, 0.25);
    this.add.ellipse(780, 50, 190, 50, 0xffffff, 0.3);
    this.add.ellipse(900, 180, 130, 35, 0xffffff, 0.2);

    // Title
    this.add.text(width / 2, 100, 'SKY BATTLES', {
      font: 'bold 64px Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(1);

    this.add.text(width / 2, 160, 'Aerial Combat Arena', {
      font: '24px Arial',
      color: '#d6eaf8'
    }).setOrigin(0.5);

    // Name input label
    this.add.text(width / 2, 250, 'Enter your name:', {
      font: '20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Create HTML input for name
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Player Name';
    this.nameInput.maxLength = 12;
    this.nameInput.value = this.lastName;
    this.nameInput.style.cssText = `
      position: absolute;
      width: 200px;
      padding: 10px;
      font-size: 16px;
      text-align: center;
      border: 2px solid #3498db;
      border-radius: 5px;
      background: #2c3e50;
      color: white;
      outline: none;
    `;
    this.positionInput(this.nameInput, width / 2 - 100, 280);
    document.body.appendChild(this.nameInput);

    // Create Room button
    this.createButton(width / 2, 380, 'CREATE ROOM', () => {
      this.handleCreateRoom();
    });

    // Join section
    this.add.text(width / 2, 480, 'Or join with code:', {
      font: '20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Room code input
    this.codeInput = document.createElement('input');
    this.codeInput.type = 'text';
    this.codeInput.placeholder = 'ROOM CODE';
    this.codeInput.maxLength = 4;
    this.codeInput.style.cssText = `
      position: absolute;
      width: 120px;
      padding: 10px;
      font-size: 18px;
      text-align: center;
      text-transform: uppercase;
      border: 2px solid #3498db;
      border-radius: 5px;
      background: #2c3e50;
      color: white;
      outline: none;
      letter-spacing: 4px;
    `;
    this.positionInput(this.codeInput, width / 2 - 60, 510);
    document.body.appendChild(this.codeInput);

    // Join button
    this.createButton(width / 2, 600, 'JOIN ROOM', () => {
      this.handleJoinRoom();
    });

    // Instructions
    this.add.text(width / 2, height - 50, 'WASD to move | Mouse to aim | Click to shoot | Space/Shift for altitude', {
      font: '14px Arial',
      color: '#7f8c8d'
    }).setOrigin(0.5);

    // Error text (hidden by default)
    this.add.text(width / 2, 700, '', {
      font: '16px Arial',
      color: '#e74c3c'
    }).setOrigin(0.5).setName('errorText');

    // Clean up inputs on scene shutdown (once — auto-removed after firing)
    this.events.once('shutdown', this.cleanup, this);
  }

  private positionInput(input: HTMLInputElement, x: number, y: number): void {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / this.cameras.main.width;
    const scaleY = rect.height / this.cameras.main.height;

    input.style.left = `${rect.left + x * scaleX}px`;
    input.style.top = `${rect.top + y * scaleY}px`;
    input.style.transform = `scale(${scaleX})`;
    input.style.transformOrigin = 'top left';
  }

  private createButton(x: number, y: number, text: string, callback: () => void): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 200, 50, 0x3498db);
    const label = this.add.text(0, 0, text, {
      font: 'bold 20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label]);
    container.setSize(200, 50);
    container.setInteractive();

    container.on('pointerover', () => bg.setFillStyle(0x2980b9));
    container.on('pointerout', () => bg.setFillStyle(0x3498db));
    container.on('pointerdown', callback);

    return container;
  }

  private showError(message: string): void {
    const errorText = this.children.getByName('errorText') as Phaser.GameObjects.Text;
    if (errorText) {
      errorText.setText(message);
      this.time.delayedCall(3000, () => errorText.setText(''));
    }
  }

  private handleCreateRoom(): void {
    const name = this.nameInput?.value.trim();
    if (!name) {
      this.showError('Please enter a name');
      return;
    }

    networkManager.createRoom(name)
      .then((room) => {
        this.cleanup();
        this.scene.start('LobbyScene', { room, isHost: true });
      })
      .catch((err) => {
        this.showError(err.message);
      });
  }

  private handleJoinRoom(): void {
    const name = this.nameInput?.value.trim();
    const code = this.codeInput?.value.trim().toUpperCase();

    if (!name) {
      this.showError('Please enter a name');
      return;
    }

    if (!code || code.length !== 4) {
      this.showError('Please enter a valid 4-letter room code');
      return;
    }

    networkManager.joinRoom(code, name)
      .then((room) => {
        this.cleanup();
        this.scene.start('LobbyScene', { room, isHost: false });
      })
      .catch((err) => {
        this.showError(err.message);
      });
  }

  private cleanup(): void {
    if (this.nameInput) {
      this.lastName = this.nameInput.value.trim() || this.lastName;
      this.nameInput.remove();
      this.nameInput = null;
    }
    if (this.codeInput) {
      this.codeInput.remove();
      this.codeInput = null;
    }
  }
}
