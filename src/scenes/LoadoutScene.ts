// ============================================
// Sky Battles - Loadout Scene
// Equipment selection before spawning
// ============================================

import Phaser from 'phaser';
import { networkManager } from '../network/NetworkManager';
import { MovementType, WeaponType, RoomInfo } from '../../shared/types';
import { WEAPON_STATS, WEAPON_COLORS, PLAYER_COLORS } from '../../shared/constants';

export class LoadoutScene extends Phaser.Scene {
  private selectedWeapon: WeaponType = WeaponType.ROCKET;
  private isReady = false;
  private room: RoomInfo | null = null;

  private weaponButtons: Map<WeaponType, Phaser.GameObjects.Container> = new Map();
  private readyButton: Phaser.GameObjects.Container | null = null;
  private playerStatusTexts: Phaser.GameObjects.Text[] = [];
  private playerReadyIndicators: Phaser.GameObjects.Arc[] = [];
  private countdownText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'LoadoutScene' });
  }

  create(): void {
    // Reset accumulated state from any previous visit
    this.selectedWeapon = WeaponType.ROCKET;
    this.isReady = false;
    this.room = null;
    this.weaponButtons = new Map();
    this.readyButton = null;
    this.playerStatusTexts = [];
    this.playerReadyIndicators = [];
    this.countdownText = null;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Sky gradient background
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x87CEEB, 0x87CEEB, 0x1A5276, 0x1A5276, 1);
    bg.fillRect(0, 0, width, height);
    this.add.ellipse(80, 75, 190, 48, 0xffffff, 0.3);
    this.add.ellipse(480, 55, 200, 45, 0xffffff, 0.25);
    this.add.ellipse(850, 90, 160, 40, 0xffffff, 0.28);

    // Title
    this.add.text(width / 2, 30, 'CHOOSE YOUR WEAPON', {
      font: 'bold 32px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Weapon options (centered)
    this.createWeaponOptions(width / 2, 100);

    // Players section at bottom
    this.add.text(width / 2, height - 180, 'PLAYERS', {
      font: 'bold 20px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.createPlayerStatusDisplay(width / 2, height - 140);

    // Ready button
    this.readyButton = this.createButton(width / 2, height - 50, 'READY', () => {
      this.toggleReady();
    }, 0x7f8c8d);

    // Countdown text (hidden initially)
    this.countdownText = this.add.text(width / 2, height / 2, '', {
      font: 'bold 128px Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setAlpha(0).setDepth(100);

    // Set up network callbacks
    this.setupNetworkCallbacks();

    // Update selection visuals
    this.updateSelections();

    // Send initial loadout (movement defaults to Wings)
    networkManager.setLoadout(MovementType.WINGS, this.selectedWeapon);
  }

  private setupNetworkCallbacks(): void {
    networkManager.onRoomUpdated = (room) => {
      this.room = room;
      this.updatePlayerStatus();
    };

    networkManager.onGameStarting = (countdown) => {
      this.showCountdown(countdown);
    };

    networkManager.onGameStarted = () => {
      this.scene.start('GameScene');
    };
  }

  private createPlayerStatusDisplay(centerX: number, y: number): void {
    const spacing = 200;
    const startX = centerX - (spacing * 1.5);

    for (let i = 0; i < 4; i++) {
      const x = startX + i * spacing;
      const color = PLAYER_COLORS[i];

      // Player color indicator
      this.add.circle(x - 50, y, 12, color);

      // Ready indicator
      const readyIndicator = this.add.circle(x + 60, y, 10, 0x7f8c8d);
      readyIndicator.setStrokeStyle(2, 0x333333);
      this.playerReadyIndicators.push(readyIndicator);

      // Player name/status text
      const text = this.add.text(x - 30, y, 'Empty', {
        font: '16px Arial',
        color: '#7f8c8d'
      }).setOrigin(0, 0.5);
      this.playerStatusTexts.push(text);
    }
  }

  private updatePlayerStatus(): void {
    if (!this.room) return;

    for (let i = 0; i < 4; i++) {
      const player = this.room.players[i];
      if (player) {
        this.playerStatusTexts[i].setText(player.name);
        this.playerStatusTexts[i].setColor('#ffffff');

        // Update ready indicator
        if (player.loadoutReady) {
          this.playerReadyIndicators[i].setFillStyle(0x2ecc71);  // Green
        } else {
          this.playerReadyIndicators[i].setFillStyle(0xe74c3c);  // Red
        }
      } else {
        this.playerStatusTexts[i].setText('Empty');
        this.playerStatusTexts[i].setColor('#7f8c8d');
        this.playerReadyIndicators[i].setFillStyle(0x7f8c8d);
      }
    }
  }

  private toggleReady(): void {
    this.isReady = !this.isReady;
    networkManager.setLoadoutReady(this.isReady);
    this.updateReadyButton();
  }

  private updateReadyButton(): void {
    if (!this.readyButton) return;

    const bg = this.readyButton.getAt(0) as Phaser.GameObjects.Rectangle;
    const label = this.readyButton.getAt(1) as Phaser.GameObjects.Text;

    if (this.isReady) {
      bg.setFillStyle(0x2ecc71);
      label.setText('READY!');
    } else {
      bg.setFillStyle(0x7f8c8d);
      label.setText('READY');
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

  private createWeaponOptions(x: number, startY: number): void {
    const weapons = [
      { type: WeaponType.MACHINE_GUN, name: 'MACHINE GUN', desc: 'High fire rate, medium damage' },
      { type: WeaponType.PULSE_LASER, name: 'PULSE LASER', desc: 'Piercing, mid-range' },
      { type: WeaponType.SNIPER, name: 'SNIPER', desc: 'One-shot kill, slow reload' },
      { type: WeaponType.ROCKET, name: 'ROCKET', desc: 'Explosive, high damage' }
    ];

    weapons.forEach((w, i) => {
      const y = startY + i * 120;
      const btn = this.createLoadoutButton(x, y, w.name, w.desc, WEAPON_COLORS[w.type], () => {
        this.selectedWeapon = w.type;
        this.updateSelections();
        networkManager.setLoadout(MovementType.WINGS, this.selectedWeapon);
      });
      this.weaponButtons.set(w.type, btn);

      // Stats display
      const stats = WEAPON_STATS[w.type];
      this.add.text(x, y + 40, `DMG: ${stats.damage} | RATE: ${stats.fireRate}/s | CLIP: ${stats.clipSize}`, {
        font: '11px Arial',
        color: '#7f8c8d'
      }).setOrigin(0.5);
    });
  }

  private createLoadoutButton(
    x: number, y: number, title: string, desc: string, color: number, callback: () => void
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 200, 70, 0x2c3e50);
    bg.setStrokeStyle(3, color);

    const colorDot = this.add.circle(-80, 0, 8, color);

    const titleText = this.add.text(-65, -12, title, {
      font: 'bold 14px Arial',
      color: '#ffffff'
    }).setOrigin(0, 0.5);

    const descText = this.add.text(-65, 8, desc, {
      font: '11px Arial',
      color: '#7f8c8d'
    }).setOrigin(0, 0.5);

    const container = this.add.container(x, y, [bg, colorDot, titleText, descText]);
    container.setSize(200, 70);
    container.setInteractive();

    container.on('pointerover', () => bg.setFillStyle(0x34495e));
    container.on('pointerout', () => bg.setFillStyle(0x2c3e50));
    container.on('pointerdown', callback);

    return container;
  }

  private updateSelections(): void {
    for (const [type, container] of this.weaponButtons) {
      const bg = container.getAt(0) as Phaser.GameObjects.Rectangle;
      const isSelected = type === this.selectedWeapon;
      bg.setStrokeStyle(3, isSelected ? 0xffffff : WEAPON_COLORS[type]);
      bg.setFillStyle(isSelected ? 0x3a506b : 0x2c3e50);
    }
  }

  private createButton(
    x: number, y: number, text: string, callback: () => void, color = 0x3498db
  ): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 200, 50, color);
    const label = this.add.text(0, 0, text, {
      font: 'bold 24px Arial',
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
    networkManager.onGameStarting = null;
    networkManager.onGameStarted = null;
  }
}
