// ============================================
// Sky Battles - Lobby Scene
// Waiting room before game starts
// ============================================

import Phaser from 'phaser';
import { networkManager } from '../network/NetworkManager';
import { RoomInfo } from '../../shared/types';
import { PLAYER_COLORS } from '../../shared/constants';

interface LobbyData {
  room: RoomInfo;
  isHost: boolean;
}

export class LobbyScene extends Phaser.Scene {
  private room: RoomInfo | null = null;
  private isHost = false;
  private isReady = false;
  private playerTexts: Phaser.GameObjects.Text[] = [];
  private readyIndicators: Phaser.GameObjects.Arc[] = [];
  private countdownText: Phaser.GameObjects.Text | null = null;
  private startButton: Phaser.GameObjects.Container | null = null;
  private readyButton: Phaser.GameObjects.Container | null = null;
  private waitingForHostText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'LobbyScene' });
  }

  init(data: LobbyData): void {
    this.room = data.room;
    this.isHost = data.isHost;
  }

  create(): void {
    // Reset accumulated state from any previous visit (scene instances persist in Phaser)
    this.playerTexts = [];
    this.readyIndicators = [];
    this.isReady = false;
    this.countdownText = null;
    this.startButton = null;
    this.readyButton = null;
    this.waitingForHostText = null;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Sky gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x1A5276, 0x1A5276, 1);
    bg.fillRect(0, 0, width, height);
    this.add.ellipse(100, 60, 200, 50, 0xffffff, 0.3);
    this.add.ellipse(500, 90, 180, 42, 0xffffff, 0.25);
    this.add.ellipse(820, 45, 170, 48, 0xffffff, 0.3);

    // Title
    this.add.text(width / 2, 50, 'GAME LOBBY', {
      font: 'bold 48px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Room code display
    this.add.text(width / 2, 120, 'ROOM CODE:', {
      font: '20px Arial',
      color: '#7f8c8d'
    }).setOrigin(0.5);

    this.add.text(width / 2, 160, this.room?.code || '????', {
      font: 'bold 64px Arial',
      color: '#2ecc71',
      letterSpacing: 10
    }).setOrigin(0.5);

    this.add.text(width / 2, 210, 'Share this code with friends!', {
      font: '16px Arial',
      color: '#7f8c8d'
    }).setOrigin(0.5);

    // Players section
    this.add.text(width / 2, 280, 'PLAYERS', {
      font: 'bold 24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Player slots
    for (let i = 0; i < 4; i++) {
      const y = 340 + i * 60;
      const color = PLAYER_COLORS[i];

      // Player color indicator
      this.add.circle(width / 2 - 150, y, 15, color);

      // Ready indicator (circle that turns green when ready)
      const readyIndicator = this.add.circle(width / 2 + 150, y, 12, 0x7f8c8d);
      readyIndicator.setStrokeStyle(2, 0x333333);
      this.readyIndicators.push(readyIndicator);

      // Player name text
      const text = this.add.text(width / 2 - 120, y, 'Waiting...', {
        font: '20px Arial',
        color: '#7f8c8d'
      }).setOrigin(0, 0.5);
      this.playerTexts.push(text);
    }

    // Ready button (for all players)
    this.readyButton = this.createButton(width / 2, 560, 'READY', () => {
      this.toggleReady();
    }, 0x7f8c8d);

    // Start button (host only) or status text (non-host)
    if (this.isHost) {
      this.startButton = this.createButton(width / 2, 630, 'START GAME', () => {
        networkManager.startGame();
      });
      this.updateStartButton();
    } else {
      this.waitingForHostText = this.add.text(width / 2, 630, 'Waiting for host to start...', {
        font: '20px Arial',
        color: '#7f8c8d'
      }).setOrigin(0.5);
    }

    // Leave button
    this.createButton(width / 2, 700, 'LEAVE', () => {
      networkManager.leaveRoom();
      this.scene.start('MenuScene');
    }, 0xe74c3c);

    // Countdown text (hidden initially)
    this.countdownText = this.add.text(width / 2, height / 2, '', {
      font: 'bold 128px Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0);

    // Set up network callbacks
    this.setupNetworkCallbacks();

    // Update player list
    this.updatePlayerList();
  }

  private setupNetworkCallbacks(): void {
    networkManager.onRoomUpdated = (room) => {
      this.room = room;

      // Check if we became the host (host transfer)
      const wasHost = this.isHost;
      this.isHost = room.hostId === networkManager.playerId;

      if (!wasHost && this.isHost) {
        this.onBecameHost();
      }

      this.updatePlayerList();
      this.updateStartButton();
    };

    networkManager.onRoomClosed = () => {
      this.scene.start('MenuScene');
    };

    networkManager.onLoadoutPhase = () => {
      this.scene.start('LoadoutScene');
    };

    networkManager.onGameStarting = (countdown) => {
      this.showCountdown(countdown);
    };

    networkManager.onGameStarted = () => {
      // This now happens after loadout phase
      this.scene.start('GameScene');
    };
  }

  private onBecameHost(): void {
    const width = this.cameras.main.width;

    // Remove the "waiting for host" text if it exists
    if (this.waitingForHostText) {
      this.waitingForHostText.destroy();
      this.waitingForHostText = null;
    }

    // Create the start button for the new host
    if (!this.startButton) {
      this.startButton = this.createButton(width / 2, 630, 'START GAME', () => {
        networkManager.startGame();
      });
      this.updateStartButton();
    }
  }

  private toggleReady(): void {
    this.isReady = !this.isReady;
    networkManager.setReady(this.isReady);
    this.updateReadyButton();
  }

  private updateReadyButton(): void {
    if (!this.readyButton) return;

    const bg = this.readyButton.getAt(0) as Phaser.GameObjects.Rectangle;
    const label = this.readyButton.getAt(1) as Phaser.GameObjects.Text;

    if (this.isReady) {
      bg.setFillStyle(0x2ecc71);  // Green when ready
      label.setText('READY!');
    } else {
      bg.setFillStyle(0x7f8c8d);  // Gray when not ready
      label.setText('READY');
    }
  }

  private updatePlayerList(): void {
    if (!this.room) return;

    for (let i = 0; i < 4; i++) {
      const player = this.room.players[i];
      if (player) {
        let text = player.name;
        if (player.id === this.room.hostId) {
          text += ' (HOST)';
        }
        this.playerTexts[i].setText(text);
        this.playerTexts[i].setColor('#ffffff');

        // Update ready indicator
        if (player.ready) {
          this.readyIndicators[i].setFillStyle(0x2ecc71);  // Green when ready
        } else {
          this.readyIndicators[i].setFillStyle(0xe74c3c);  // Red when not ready
        }
        this.readyIndicators[i].setVisible(true);
      } else {
        this.playerTexts[i].setText('Waiting...');
        this.playerTexts[i].setColor('#7f8c8d');
        this.readyIndicators[i].setFillStyle(0x7f8c8d);  // Gray when empty
        this.readyIndicators[i].setVisible(true);
      }
    }
  }

  private updateStartButton(): void {
    if (!this.startButton || !this.room) return;

    const hasEnoughPlayers = this.room.players.length >= 2;
    const allReady = this.room.players.every(p => p.ready);
    const canStart = hasEnoughPlayers && allReady;

    const bg = this.startButton.getAt(0) as Phaser.GameObjects.Rectangle;
    const label = this.startButton.getAt(1) as Phaser.GameObjects.Text;

    if (canStart) {
      bg.setFillStyle(0x2ecc71);
      this.startButton.setAlpha(1);
      label.setText('START GAME');
    } else if (!hasEnoughPlayers) {
      bg.setFillStyle(0x7f8c8d);
      this.startButton.setAlpha(0.5);
      label.setText('NEED 2+ PLAYERS');
    } else {
      bg.setFillStyle(0x7f8c8d);
      this.startButton.setAlpha(0.5);
      label.setText('WAITING FOR READY');
    }
  }

  private showCountdown(count: number): void {
    if (!this.countdownText) return;

    this.countdownText.setText(count.toString());
    this.countdownText.setAlpha(1);
    this.countdownText.setScale(2);

    this.tweens.add({
      targets: this.countdownText,
      scale: 1,
      alpha: 0,
      duration: 800,
      ease: 'Power2'
    });
  }

  private createButton(
    x: number, y: number, text: string, callback: () => void, color = 0x3498db
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 200, 50, color);
    const label = this.add.text(0, 0, text, {
      font: 'bold 20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label]);
    container.setSize(200, 50);
    container.setInteractive();

    container.on('pointerover', () => bg.setFillStyle(Phaser.Display.Color.ValueToColor(color).darken(20).color));
    container.on('pointerout', () => bg.setFillStyle(color));
    container.on('pointerdown', callback);

    return container;
  }

  shutdown(): void {
    networkManager.onRoomUpdated = null;
    networkManager.onRoomClosed = null;
    networkManager.onLoadoutPhase = null;
    networkManager.onGameStarting = null;
    networkManager.onGameStarted = null;
  }
}
