// ============================================
// Sky Battles - Game Scene
// Main gameplay with all combat mechanics
// ============================================

import Phaser from 'phaser';
import { networkManager } from '../network/NetworkManager';
import {
  GameState,
  PlayerState,
  ProjectileState,
  InputState,
  ArenaId,
  WeaponType,
  RoomInfo
} from '../../shared/types';
import {
  ARENAS,
  PLAYER_RADIUS,
  WEAPON_COLORS,
  WEAPON_STATS,
  GAME_WIDTH,
  GAME_HEIGHT,
  MAX_Z
} from '../../shared/constants';

// Visual representation of a player
interface PlayerSprite {
  container: Phaser.GameObjects.Container;
  plane: Phaser.GameObjects.Polygon;
  shadow: Phaser.GameObjects.Ellipse;
  nameText: Phaser.GameObjects.Text;
  healthBar: Phaser.GameObjects.Rectangle;
  healthBarBg: Phaser.GameObjects.Rectangle;
  fuelBar: Phaser.GameObjects.Rectangle;
  fuelBarBg: Phaser.GameObjects.Rectangle;
}

// Visual representation of a projectile
interface ProjectileSprite {
  graphics: Phaser.GameObjects.Graphics;
  type: WeaponType;
  trailGraphics?: Phaser.GameObjects.Graphics;
}

export class GameScene extends Phaser.Scene {
  // Game state
  private gameState: GameState | null = null;
  private localPlayerId: string | null = null;

  // Visual objects
  private playerSprites: Map<string, PlayerSprite> = new Map();
  private projectileSprites: Map<string, ProjectileSprite> = new Map();
  private arenaStaticGraphics: Phaser.GameObjects.Graphics | null = null;
  private arenaObstacleGraphics: Phaser.GameObjects.Graphics | null = null;
  private minimapGraphics: Phaser.GameObjects.Graphics | null = null;
  private currentDrawnArenaId: ArenaId | null = null;
  private arenaLabelTexts: Phaser.GameObjects.Text[] = [];

  // Input state
  private inputSequence = 0;
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private wasd: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key } | null = null;
  private spaceKey: Phaser.Input.Keyboard.Key | null = null;
  private shiftKey: Phaser.Input.Keyboard.Key | null = null;
  private reloadKey: Phaser.Input.Keyboard.Key | null = null;

  // HUD
  private arenaNameText: Phaser.GameObjects.Text | null = null;
  private killFeedTexts: Phaser.GameObjects.Text[] = [];
  private respawnButton: Phaser.GameObjects.Container | null = null;
  private weaponText: Phaser.GameObjects.Text | null = null;
  private ammoText: Phaser.GameObjects.Text | null = null;
  private reloadText: Phaser.GameObjects.Text | null = null;
  private statsText: Phaser.GameObjects.Text | null = null;
  private leaderboardTexts: Phaser.GameObjects.Text[] = [];
  private leaderboardBg: Phaser.GameObjects.Rectangle | null = null;

  // Sniper hitscan graphics
  private hitscanGraphics: Phaser.GameObjects.Graphics | null = null;

  // Interpolation
  private previousState: GameState | null = null;
  private interpolationAlpha = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    // Reset accumulated state from any previous visit
    this.gameState = null;
    this.previousState = null;
    this.playerSprites = new Map();
    this.projectileSprites = new Map();
    this.killFeedTexts = [];
    this.inputSequence = 0;
    this.interpolationAlpha = 0;
    this.currentDrawnArenaId = null;
    this.arenaLabelTexts = [];

    this.localPlayerId = networkManager.playerId || null;

    // Set up input
    this.cursors = this.input.keyboard?.createCursorKeys() || null;
    this.wasd = {
      W: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D)
    };
    this.spaceKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.shiftKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    this.reloadKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.R);

    // Reload key handler
    this.reloadKey.on('down', () => {
      networkManager.requestReload();
    });

    // Create graphics layers (static arena drawn once, obstacles redrawn each frame)
    this.arenaStaticGraphics = this.add.graphics();
    this.arenaObstacleGraphics = this.add.graphics();
    this.minimapGraphics = this.add.graphics();
    this.hitscanGraphics = this.add.graphics();
    this.hitscanGraphics.setDepth(50);

    // Create HUD
    this.createHUD();

    // Set up network callbacks
    this.setupNetworkCallbacks();

    // Start input send loop
    this.time.addEvent({
      delay: 50,  // 20Hz input rate
      callback: this.sendInput,
      callbackScope: this,
      loop: true
    });
  }

  private setupNetworkCallbacks(): void {
    networkManager.onGameState = (state) => {
      this.previousState = this.gameState;
      this.gameState = state;
      this.interpolationAlpha = 0;
    };

    networkManager.onGameHit = (data) => {
      this.showHitEffect(data.targetId);
    };

    networkManager.onGameKill = (data) => {
      this.showKillFeed(data.killerId, data.victimId);
    };

    networkManager.onGameEnded = (data) => {
      this.showGameEnded(data);
    };

    networkManager.onGameHitscan = (data) => {
      this.showSniperShot(data.startX, data.startY, data.endX, data.endY);
    };
  }

  update(_time: number, delta: number): void {
    if (!this.gameState) return;

    // Interpolate between states
    this.interpolationAlpha = Math.min(1, this.interpolationAlpha + delta / 50);

    // Get local player
    const localPlayer = this.localPlayerId ? this.gameState.players[this.localPlayerId] : null;

    // Update arena graphics (static layer only redraws on arena change)
    if (localPlayer) {
      if (localPlayer.currentArena !== this.currentDrawnArenaId) {
        this.drawArenaStatic(localPlayer.currentArena);
      }
      this.drawObstacles();
    }

    // Update player sprites
    this.updatePlayerSprites();

    // Update projectile sprites
    this.updateProjectileSprites();

    // Update minimap
    this.drawMinimap();

    // Show/hide respawn button
    if (localPlayer?.isDead && !this.respawnButton?.visible) {
      this.showRespawnButton();
    } else if (!localPlayer?.isDead && this.respawnButton?.visible) {
      this.hideRespawnButton();
    }

    // Update ammo HUD
    if (localPlayer && !localPlayer.isDead) {
      const weaponName = localPlayer.weapon.replace(/_/g, ' ').toUpperCase();
      this.weaponText?.setText(weaponName);
      this.ammoText?.setText(`${localPlayer.ammo} / ${WEAPON_STATS[localPlayer.weapon].clipSize}`);
      this.reloadText?.setText(localPlayer.isReloading ? 'RELOADING...' : '');

      // Update player stats
      this.statsText?.setText(`Kills: ${localPlayer.kills} | Deaths: ${localPlayer.deaths}`);
    } else {
      this.weaponText?.setText('');
      this.ammoText?.setText('');
      this.reloadText?.setText('');
    }

    // Update leaderboard
    this.updateLeaderboard();
  }

  private updateLeaderboard(): void {
    if (!this.gameState) return;

    // Sort players by kills descending
    const sortedPlayers = Object.values(this.gameState.players)
      .sort((a, b) => b.kills - a.kills);

    // Update leaderboard texts
    for (let i = 0; i < this.leaderboardTexts.length; i++) {
      const player = sortedPlayers[i];
      if (player) {
        const isLocal = player.id === this.localPlayerId;
        const prefix = isLocal ? '> ' : '  ';
        this.leaderboardTexts[i].setText(`${prefix}${player.name}: ${player.kills}K / ${player.deaths}D`);
        this.leaderboardTexts[i].setColor(isLocal ? '#f1c40f' : '#ffffff');
      } else {
        this.leaderboardTexts[i].setText('');
      }
    }
  }

  private sendInput = (): void => {
    if (!this.cursors || !this.wasd) return;

    const pointer = this.input.activePointer;
    const localPlayer = this.localPlayerId && this.gameState?.players[this.localPlayerId];

    // Calculate angle from player to mouse
    let mouseAngle = 0;
    if (localPlayer) {
      mouseAngle = Math.atan2(
        pointer.y - localPlayer.y,
        pointer.x - localPlayer.x
      );
    }

    const input: InputState = {
      up: this.wasd.W.isDown || this.cursors.up.isDown,
      down: this.wasd.S.isDown || this.cursors.down.isDown,
      left: this.wasd.A.isDown || this.cursors.left.isDown,
      right: this.wasd.D.isDown || this.cursors.right.isDown,
      jump: this.spaceKey!.isDown,
      crouch: this.shiftKey!.isDown,
      shooting: pointer.isDown,
      mouseAngle,
      timestamp: Date.now(),
      sequence: this.inputSequence++
    };

    networkManager.sendInput(input);
  };

  // Draws the static arena layer (background, walls, platforms, doors).
  // Only called when the player's arena changes — not every frame.
  private drawArenaStatic(arenaId: ArenaId): void {
    if (!this.arenaStaticGraphics) return;
    this.arenaStaticGraphics.clear();

    // Destroy previous door / safe-zone label texts
    for (const t of this.arenaLabelTexts) {
      t.destroy();
    }
    this.arenaLabelTexts = [];

    const arena = ARENAS[arenaId];
    if (!arena) return;

    // Sky gradient background
    const isSpawn = arenaId.startsWith('spawn');
    if (isSpawn) {
      this.arenaStaticGraphics.fillGradientStyle(0x2ecc71, 0x2ecc71, 0x1a6b3a, 0x1a6b3a, 1);
    } else {
      this.arenaStaticGraphics.fillGradientStyle(0x5ba3d9, 0x5ba3d9, 0x1A5276, 0x1A5276, 1);
    }
    this.arenaStaticGraphics.fillRect(0, 0, arena.width, arena.height);

    // Spawn room indicator
    if (isSpawn) {
      this.arenaStaticGraphics.lineStyle(4, 0x2ecc71, 0.5);
      this.arenaStaticGraphics.strokeRect(10, 10, arena.width - 20, arena.height - 20);

      this.arenaLabelTexts.push(
        this.add.text(arena.width / 2, 30, 'SAFE ZONE', {
          font: 'bold 20px Arial',
          color: '#2ecc71'
        }).setOrigin(0.5).setAlpha(0.7)
      );
    }

    // Solid walls
    this.arenaStaticGraphics.fillStyle(0x4a4a6a, 1);
    for (const wall of arena.walls) {
      this.arenaStaticGraphics.fillRect(wall.x, wall.y, wall.width, wall.height);
    }

    // Platforms (with height-indicator stripes)
    for (const platform of arena.platforms) {
      const alpha = 0.3 + (platform.minZ / MAX_Z) * 0.4;
      this.arenaStaticGraphics.fillStyle(0x8b4513, alpha);
      this.arenaStaticGraphics.fillRect(platform.x, platform.y, platform.width, platform.height);

      this.arenaStaticGraphics.lineStyle(1, 0xffffff, 0.2);
      const stripes = Math.floor(platform.minZ / 20);
      for (let i = 0; i < stripes; i++) {
        const y = platform.y + platform.height - (i + 1) * 10;
        if (y > platform.y) {
          this.arenaStaticGraphics.lineBetween(platform.x, y, platform.x + platform.width, y);
        }
      }
    }

    // Doors (dashed lines + cached labels)
    this.arenaStaticGraphics.lineStyle(3, 0x3498db, 1);
    for (const door of arena.doors) {
      const segments = 5;
      if (door.width > door.height) {
        const segWidth = door.width / (segments * 2 - 1);
        for (let i = 0; i < segments; i++) {
          const x = door.x + i * segWidth * 2;
          this.arenaStaticGraphics.lineBetween(x, door.y + door.height / 2, x + segWidth, door.y + door.height / 2);
        }
      } else {
        const segHeight = door.height / (segments * 2 - 1);
        for (let i = 0; i < segments; i++) {
          const y = door.y + i * segHeight * 2;
          this.arenaStaticGraphics.lineBetween(door.x + door.width / 2, y, door.x + door.width / 2, y + segHeight);
        }
      }

      const labelX = door.x + door.width / 2;
      const labelY = door.y + door.height / 2 + (door.height > door.width ? 0 : 15);
      this.arenaLabelTexts.push(
        this.add.text(labelX, labelY, `→ ${ARENAS[door.to]?.name || door.to}`, {
          font: '12px Arial',
          color: '#3498db'
        }).setOrigin(0.5)
      );
    }

    // Update arena-name HUD
    if (this.arenaNameText) {
      this.arenaNameText.setText(arena.name || arenaId);
    }

    this.currentDrawnArenaId = arenaId;
  }

  // Redraws only the breakable-obstacle layer each frame.
  private drawObstacles(): void {
    if (!this.arenaObstacleGraphics || !this.gameState) return;
    this.arenaObstacleGraphics.clear();

    for (const obs of this.gameState.obstacles) {
      const healthRatio = obs.health / obs.maxHealth;

      // Body — warm brown, opacity based on health
      this.arenaObstacleGraphics.fillStyle(0xcd853f, 0.6 + healthRatio * 0.4);
      this.arenaObstacleGraphics.fillRect(obs.x, obs.y, obs.width, obs.height);

      // Crack pattern when damaged
      if (healthRatio < 1) {
        this.arenaObstacleGraphics.lineStyle(1, 0x8b4513, 0.6);
        this.arenaObstacleGraphics.lineBetween(obs.x, obs.y + obs.height * 0.3, obs.x + obs.width * 0.7, obs.y + obs.height * 0.8);
        this.arenaObstacleGraphics.lineBetween(obs.x + obs.width * 0.4, obs.y, obs.x + obs.width * 0.2, obs.y + obs.height * 0.6);
      }

      // Border
      this.arenaObstacleGraphics.lineStyle(2, 0x8b4513, 1);
      this.arenaObstacleGraphics.strokeRect(obs.x, obs.y, obs.width, obs.height);

      // Health bar
      const barY = obs.y - 8;
      this.arenaObstacleGraphics.fillStyle(0x333333, 0.8);
      this.arenaObstacleGraphics.fillRect(obs.x, barY, obs.width, 5);

      const barColor = healthRatio > 0.5 ? 0x2ecc71 : healthRatio > 0.25 ? 0xf39c12 : 0xe74c3c;
      this.arenaObstacleGraphics.fillStyle(barColor, 1);
      this.arenaObstacleGraphics.fillRect(obs.x, barY, obs.width * healthRatio, 5);
    }
  }

  private updatePlayerSprites(): void {
    if (!this.gameState) return;

    // Create or update player sprites - show all players in single arena mode
    for (const [id, player] of Object.entries(this.gameState.players)) {
      let sprite = this.playerSprites.get(id);
      if (!sprite) {
        sprite = this.createPlayerSprite(player);
        this.playerSprites.set(id, sprite);
      }

      this.updatePlayerSprite(sprite, player, id === this.localPlayerId);
    }

    // Remove sprites for players who left
    for (const [id, sprite] of this.playerSprites) {
      if (!this.gameState.players[id]) {
        sprite.container.destroy();
        this.playerSprites.delete(id);
      }
    }
  }

  private createPlayerSprite(player: PlayerState): PlayerSprite {
    // Shadow (rendered first, below everything)
    const shadow = this.add.ellipse(0, 0, PLAYER_RADIUS * 2, PLAYER_RADIUS, 0x000000, 0.3);

    // Jet fighter silhouette — nose points right (+x) at rotation 0
    // Points are pre-centred so the bounding-box middle sits at (0, 0)
    const planePoints = [
      12, 0,     // nose
      -4, -3,    // left wing root
      -7, -9,    // left wing tip
      -5, -1,    // left tail base
      -9, 0,     // tail
      -5, 1,     // right tail base
      -7, 9,     // right wing tip
      -4, 3      // right wing root
    ];
    const plane = this.add.polygon(0, 0, planePoints, player.color);
    plane.setStrokeStyle(1.5, 0xffffff);
    plane.setOrigin(0.5, 0.5);

    // Name text
    const nameText = this.add.text(0, -PLAYER_RADIUS - 25, player.name, {
      font: '12px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    // Health bar background
    const healthBarBg = this.add.rectangle(0, -PLAYER_RADIUS - 10, 40, 6, 0x333333);

    // Health bar
    const healthBar = this.add.rectangle(-20, -PLAYER_RADIUS - 10, 40, 6, 0x2ecc71);
    healthBar.setOrigin(0, 0.5);

    // Fuel bar background
    const fuelBarBg = this.add.rectangle(0, -PLAYER_RADIUS - 3, 40, 4, 0x333333);

    // Fuel bar
    const fuelBar = this.add.rectangle(-20, -PLAYER_RADIUS - 3, 40, 4, 0x3498db);
    fuelBar.setOrigin(0, 0.5);

    // Container for all elements
    const container = this.add.container(player.x, player.y, [
      shadow, plane, nameText, healthBarBg, healthBar, fuelBarBg, fuelBar
    ]);

    return {
      container,
      plane,
      shadow,
      nameText,
      healthBar,
      healthBarBg,
      fuelBar,
      fuelBarBg
    };
  }

  private updatePlayerSprite(sprite: PlayerSprite, player: PlayerState, isLocal: boolean): void {
    // Interpolate position
    let targetX = player.x;
    let targetY = player.y;

    if (this.previousState && !isLocal) {
      const prevPlayer = this.previousState.players[player.id];
      if (prevPlayer) {
        targetX = Phaser.Math.Linear(prevPlayer.x, player.x, this.interpolationAlpha);
        targetY = Phaser.Math.Linear(prevPlayer.y, player.y, this.interpolationAlpha);
      }
    }

    sprite.container.setPosition(targetX, targetY);
    sprite.container.setVisible(!player.isDead);

    // Rotate jet to face direction
    sprite.plane.setRotation(player.angle);

    // Update shadow based on altitude
    const shadowOffset = player.z * 0.5;
    sprite.shadow.setPosition(shadowOffset * 0.3, shadowOffset);
    sprite.shadow.setScale(1 + player.z / 200);
    sprite.shadow.setAlpha(0.3 - player.z / 500);

    // Scale jet slightly based on altitude
    const scale = 1 + player.z / 500;
    sprite.plane.setScale(scale);

    // Update health bar
    const healthPercent = player.health / player.maxHealth;
    sprite.healthBar.setScale(healthPercent, 1);
    sprite.healthBar.setFillStyle(healthPercent > 0.3 ? 0x2ecc71 : 0xe74c3c);

    // Update fuel bar
    if (player.maxFuel > 0) {
      sprite.fuelBarBg.setVisible(true);
      sprite.fuelBar.setVisible(true);
      const fuelPercent = player.fuel / player.maxFuel;
      sprite.fuelBar.setScale(fuelPercent, 1);
    } else {
      sprite.fuelBarBg.setVisible(false);
      sprite.fuelBar.setVisible(false);
    }

    // Update jet color
    sprite.plane.setFillStyle(player.color);

    // Stroke: spawn glow → local highlight → default
    if (isLocal) {
      sprite.plane.setStrokeStyle(2.5, 0xf1c40f);
    } else if (player.isInSpawn) {
      sprite.plane.setStrokeStyle(2.5, 0x2ecc71);
    } else {
      sprite.plane.setStrokeStyle(1.5, 0xffffff);
    }
  }

  private updateProjectileSprites(): void {
    if (!this.gameState) return;

    // Track which projectiles still exist
    const activeIds = new Set<string>();

    // Create or update projectile sprites - show all in single arena mode
    for (const proj of this.gameState.projectiles) {
      activeIds.add(proj.id);

      let sprite = this.projectileSprites.get(proj.id);
      if (!sprite) {
        sprite = this.createProjectileSprite(proj);
        this.projectileSprites.set(proj.id, sprite);
      }

      this.updateProjectileSprite(sprite, proj);
    }

    // Remove sprites for projectiles that no longer exist
    for (const [id, sprite] of this.projectileSprites) {
      if (!activeIds.has(id)) {
        sprite.graphics.destroy();
        this.projectileSprites.delete(id);
      }
    }
  }

  private createProjectileSprite(proj: ProjectileState): ProjectileSprite {
    const graphics = this.add.graphics();
    return { graphics, type: proj.type };
  }

  private updateProjectileSprite(sprite: ProjectileSprite, proj: ProjectileState): void {
    sprite.graphics.clear();

    const color = WEAPON_COLORS[proj.type];

    // Different rendering for rockets
    if (proj.type === WeaponType.ROCKET) {
      this.drawRocketProjectile(sprite.graphics, proj.x, proj.y, proj.angle, color);
    } else {
      // Standard projectile (circular)
      // Outer glow
      sprite.graphics.fillStyle(color, 0.3);
      sprite.graphics.fillCircle(proj.x, proj.y, 8);

      // Inner core
      sprite.graphics.fillStyle(color, 1);
      sprite.graphics.fillCircle(proj.x, proj.y, 4);
    }
  }

  private drawRocketProjectile(graphics: Phaser.GameObjects.Graphics, x: number, y: number, angle: number, color: number): void {
    graphics.save();
    graphics.translateCanvas(x, y);
    graphics.rotateCanvas(angle);

    // Exhaust trail (flame effect)
    for (let i = 0; i < 5; i++) {
      const trailX = -12 - i * 4 + (Math.random() - 0.5) * 4;
      const trailY = (Math.random() - 0.5) * 6;
      const trailSize = 6 - i;
      const alpha = 0.8 - i * 0.15;

      // Orange/yellow flame
      graphics.fillStyle(i < 2 ? 0xffff00 : 0xff6600, alpha);
      graphics.fillCircle(trailX, trailY, trailSize);
    }

    // Rocket body (elongated shape)
    graphics.fillStyle(0x888888, 1);
    graphics.fillRect(-8, -3, 16, 6);

    // Rocket nose (pointed)
    graphics.fillStyle(color, 1);
    graphics.fillTriangle(8, -4, 8, 4, 14, 0);

    // Rocket fins
    graphics.fillStyle(0x666666, 1);
    graphics.fillTriangle(-8, -3, -8, -7, -4, -3);
    graphics.fillTriangle(-8, 3, -8, 7, -4, 3);

    // Highlight on body
    graphics.fillStyle(0xaaaaaa, 0.5);
    graphics.fillRect(-6, -2, 10, 2);

    graphics.restore();
  }

  private createHUD(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Arena name
    this.arenaNameText = this.add.text(width / 2, 30, '', {
      font: 'bold 24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(100);

    // Kill feed container (top right)
    for (let i = 0; i < 5; i++) {
      const text = this.add.text(width - 20, 50 + i * 25, '', {
        font: '14px Arial',
        color: '#ffffff'
      }).setOrigin(1, 0).setScrollFactor(0).setDepth(100);
      this.killFeedTexts.push(text);
    }

    // Player stats (kills/deaths) - below minimap
    this.statsText = this.add.text(20, 185, 'Kills: 0 | Deaths: 0', {
      font: 'bold 16px Arial',
      color: '#ffffff'
    }).setScrollFactor(0).setDepth(100);

    // Leaderboard background
    this.leaderboardBg = this.add.rectangle(20, 230, 160, 120, 0x000000, 0.5);
    this.leaderboardBg.setOrigin(0, 0).setScrollFactor(0).setDepth(99);

    // Leaderboard title
    this.add.text(100, 238, 'LEADERBOARD', {
      font: 'bold 12px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(100);

    // Leaderboard entries (4 players max)
    for (let i = 0; i < 4; i++) {
      const text = this.add.text(30, 260 + i * 20, '', {
        font: '12px Arial',
        color: '#ffffff'
      }).setScrollFactor(0).setDepth(100);
      this.leaderboardTexts.push(text);
    }

    // Respawn button (hidden initially)
    this.respawnButton = this.createRespawnButton(width / 2, height / 2);
    this.respawnButton.setVisible(false);

    // Controls reminder
    this.add.text(20, height - 30, 'WASD: Move | Space/Shift: Up/Down | Click: Shoot | R: Reload', {
      font: '12px Arial',
      color: '#7f8c8d'
    }).setScrollFactor(0).setDepth(100);

    // Ammo display (bottom right)
    this.weaponText = this.add.text(width - 20, height - 100, '', {
      font: '14px Arial',
      color: '#7f8c8d'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);

    this.ammoText = this.add.text(width - 20, height - 70, '', {
      font: 'bold 28px Arial',
      color: '#ffffff'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);

    this.reloadText = this.add.text(width - 20, height - 45, '', {
      font: 'bold 14px Arial',
      color: '#e74c3c'
    }).setOrigin(1, 1).setScrollFactor(0).setDepth(100);

    // Reload button
    this.createReloadButton(width - 70, height - 15);
  }

  private createReloadButton(x: number, y: number): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 100, 30, 0x3498db, 0.8);
    bg.setStrokeStyle(2, 0x2980b9);
    const label = this.add.text(0, 0, '[ RELOAD ]', {
      font: 'bold 12px Arial',
      color: '#ffffff'
    }).setOrigin(0.5);

    const container = this.add.container(x, y, [bg, label]);
    container.setSize(100, 30);
    container.setInteractive();
    container.setScrollFactor(0).setDepth(100);

    container.on('pointerover', () => bg.setFillStyle(0x2980b9, 1));
    container.on('pointerout', () => bg.setFillStyle(0x3498db, 0.8));
    container.on('pointerdown', () => {
      networkManager.requestReload();
    });

    return container;
  }

  private createRespawnButton(x: number, y: number): Phaser.GameObjects.Container {
    const bg = this.add.rectangle(0, 0, 200, 60, 0x000000, 0.8);
    const label = this.add.text(0, -10, 'YOU DIED', {
      font: 'bold 24px Arial',
      color: '#e74c3c'
    }).setOrigin(0.5);
    const button = this.add.text(0, 20, '[ RESPAWN ]', {
      font: '18px Arial',
      color: '#3498db'
    }).setOrigin(0.5).setInteractive();

    button.on('pointerover', () => button.setColor('#ffffff'));
    button.on('pointerout', () => button.setColor('#3498db'));
    button.on('pointerdown', () => {
      networkManager.requestRespawn();
    });

    const container = this.add.container(x, y, [bg, label, button]);
    container.setScrollFactor(0).setDepth(200);
    return container;
  }

  private showRespawnButton(): void {
    if (this.respawnButton) {
      this.respawnButton.setVisible(true);
    }
  }

  private hideRespawnButton(): void {
    if (this.respawnButton) {
      this.respawnButton.setVisible(false);
    }
  }

  private drawMinimap(): void {
    if (!this.minimapGraphics || !this.gameState) return;
    this.minimapGraphics.clear();

    const mapX = 20;
    const mapY = 20;
    const mapSize = 150;
    const gameWidth = GAME_WIDTH;
    const gameHeight = GAME_HEIGHT;
    const scaleX = mapSize / gameWidth;
    const scaleY = mapSize / gameHeight;

    // Background
    this.minimapGraphics.fillStyle(0x000000, 0.5);
    this.minimapGraphics.fillRect(mapX, mapY, mapSize, mapSize * (gameHeight / gameWidth));

    // Border
    this.minimapGraphics.lineStyle(1, 0x4a4a6a, 1);
    this.minimapGraphics.strokeRect(mapX, mapY, mapSize, mapSize * (gameHeight / gameWidth));

    // Draw player dots with actual positions
    for (const player of Object.values(this.gameState.players)) {
      if (player.isDead) continue;

      const dotX = mapX + player.x * scaleX;
      const dotY = mapY + player.y * scaleY;

      this.minimapGraphics.fillStyle(player.color, 1);
      this.minimapGraphics.fillCircle(dotX, dotY, 4);

      // Highlight local player
      if (player.id === this.localPlayerId) {
        this.minimapGraphics.lineStyle(2, 0xf1c40f, 1);
        this.minimapGraphics.strokeCircle(dotX, dotY, 7);
      }
    }
  }

  private showHitEffect(targetId: string): void {
    const sprite = this.playerSprites.get(targetId);
    if (!sprite) return;

    // Flash red
    this.tweens.add({
      targets: sprite.plane,
      fillColor: { from: 0xff0000, to: sprite.plane.fillColor },
      duration: 200
    });
  }

  private showSniperShot(startX: number, startY: number, endX: number, endY: number): void {
    if (!this.hitscanGraphics) return;

    // Draw the sniper beam
    this.hitscanGraphics.clear();

    // Outer glow (wider, semi-transparent)
    this.hitscanGraphics.lineStyle(8, 0xff0000, 0.3);
    this.hitscanGraphics.lineBetween(startX, startY, endX, endY);

    // Inner beam (bright red)
    this.hitscanGraphics.lineStyle(3, 0xff0000, 1);
    this.hitscanGraphics.lineBetween(startX, startY, endX, endY);

    // Core (white hot center)
    this.hitscanGraphics.lineStyle(1, 0xffffff, 1);
    this.hitscanGraphics.lineBetween(startX, startY, endX, endY);

    // Impact spark at end point
    this.hitscanGraphics.fillStyle(0xffff00, 1);
    this.hitscanGraphics.fillCircle(endX, endY, 8);
    this.hitscanGraphics.fillStyle(0xffffff, 1);
    this.hitscanGraphics.fillCircle(endX, endY, 4);

    // Fade out the beam
    this.time.delayedCall(100, () => {
      this.tweens.add({
        targets: this.hitscanGraphics,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          this.hitscanGraphics?.clear();
          this.hitscanGraphics?.setAlpha(1);
        }
      });
    });
  }

  private showKillFeed(killerId: string, victimId: string): void {
    const killer = this.gameState?.players[killerId];
    const victim = this.gameState?.players[victimId];

    if (!killer || !victim) return;

    // Shift existing messages down
    for (let i = this.killFeedTexts.length - 1; i > 0; i--) {
      this.killFeedTexts[i].setText(this.killFeedTexts[i - 1].text);
    }

    // Add new message
    this.killFeedTexts[0].setText(`${killer.name} killed ${victim.name}`);
    this.killFeedTexts[0].setAlpha(1);

    // Fade out after delay
    this.time.delayedCall(5000, () => {
      this.tweens.add({
        targets: this.killFeedTexts[0],
        alpha: 0,
        duration: 1000
      });
    });
  }

  private showGameEnded(data: { winnerId: string; scores: Record<string, { kills: number; deaths: number }> }): void {
    // Stop sending input
    networkManager.onGameState = null;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Dark overlay
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.75);
    overlay.setScrollFactor(0).setDepth(300);

    // Winner name
    const winner = this.gameState?.players[data.winnerId];
    const winnerName = winner?.name || 'Player';

    this.add.text(width / 2, 120, 'GAME OVER', {
      font: 'bold 56px Arial',
      color: '#e74c3c'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    this.add.text(width / 2, 200, `${winnerName} WINS!`, {
      font: 'bold 40px Arial',
      color: '#f1c40f'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    // Scoreboard
    let yOffset = 280;
    this.add.text(width / 2, yOffset, 'SCORES', {
      font: 'bold 24px Arial',
      color: '#ffffff'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
    yOffset += 40;

    // Sort players by kills descending
    const sortedPlayers = Object.entries(data.scores)
      .map(([id, score]) => ({ id, ...score, name: this.gameState?.players[id]?.name || 'Player' }))
      .sort((a, b) => b.kills - a.kills);

    for (const p of sortedPlayers) {
      const isWinner = p.id === data.winnerId;
      this.add.text(width / 2, yOffset, `${p.name}  —  ${p.kills} kills / ${p.deaths} deaths`, {
        font: isWinner ? 'bold 22px Arial' : '20px Arial',
        color: isWinner ? '#f1c40f' : '#ecf0f1'
      }).setOrigin(0.5).setScrollFactor(0).setDepth(301);
      yOffset += 36;
    }

    // Return to lobby after 5 seconds — capture the room:updated the server sends post-game
    this.add.text(width / 2, height - 60, 'Returning to lobby...', {
      font: '18px Arial',
      color: '#7f8c8d'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(301);

    let capturedRoom: RoomInfo | null = null;
    networkManager.onRoomUpdated = (room) => {
      capturedRoom = room;
    };

    this.time.delayedCall(5000, () => {
      networkManager.onRoomUpdated = null;
      if (capturedRoom) {
        this.scene.start('LobbyScene', {
          room: capturedRoom,
          isHost: capturedRoom.hostId === networkManager.playerId
        });
      } else {
        // Fallback: go to menu if room info never arrived
        this.scene.start('MenuScene');
      }
    });
  }

  shutdown(): void {
    // Clean up network callbacks
    networkManager.onGameState = null;
    networkManager.onGameHit = null;
    networkManager.onGameKill = null;
    networkManager.onGameEnded = null;

    // Clean up sprites
    for (const sprite of this.playerSprites.values()) {
      sprite.container.destroy();
    }
    this.playerSprites.clear();

    for (const sprite of this.projectileSprites.values()) {
      sprite.graphics.destroy();
    }
    this.projectileSprites.clear();
  }
}
