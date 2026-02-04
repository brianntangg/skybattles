// ============================================
// Sky Battles - Game Room
// Manages a single multiplayer game instance
// ============================================

import { Server } from 'socket.io';
import {
  PlayerState,
  ProjectileState,
  GameState,
  InputState,
  RoomInfo,
  MovementType,
  WeaponType,
  ArenaId,
  BreakableObstacle,
  RoomPlayer,
  ServerToClientEvents,
  ClientToServerEvents
} from '../shared/types';
import {
  TICK_RATE,
  MAX_HEALTH,
  DEFAULT_Z,
  MOVEMENT_STATS,
  WEAPON_STATS,
  PLAYER_COLORS,
  ARENAS,
  PLAYER_RADIUS,
  MIN_Z,
  MAX_Z,
  Z_HIT_TOLERANCE,
  GRAVITY,
  KILL_LIMIT
} from '../shared/constants';

// Security: Max projectiles per player to prevent memory exhaustion
const MAX_PROJECTILES_PER_PLAYER = 50;

export class GameRoom {
  code: string;
  hostId: string;
  private io: Server<ClientToServerEvents, ServerToClientEvents>;

  private lobbyPlayers: Map<string, RoomPlayer> = new Map();
  private players: Map<string, PlayerState> = new Map();
  private projectiles: Map<string, ProjectileState> = new Map();
  private obstacles: Map<string, BreakableObstacle> = new Map();
  private playerInputs: Map<string, InputState> = new Map();

  gameStarted = false;
  inLoadoutPhase = false;
  private gameLoop: NodeJS.Timeout | null = null;
  private tick = 0;
  private projectileIdCounter = 0;
  private lastShotTime: Map<string, number> = new Map();
  private reloadTimers: Map<string, NodeJS.Timeout> = new Map();
  private spawnProtectionTimers: Map<string, NodeJS.Timeout> = new Map();
  private countdownStarted = false;
  private countdownInterval: NodeJS.Timeout | null = null;

  constructor(code: string, hostId: string, io: Server<ClientToServerEvents, ServerToClientEvents>) {
    this.code = code;
    this.hostId = hostId;
    this.io = io;
  }

  get playerCount(): number {
    return this.lobbyPlayers.size;
  }

  addPlayer(id: string, name: string): void {
    this.lobbyPlayers.set(id, {
      id,
      name,
      ready: false,
      loadoutReady: false,
      movement: MovementType.WINGS,
      weapon: WeaponType.ROCKET
    });
  }

  removePlayer(id: string): void {
    this.lobbyPlayers.delete(id);
    this.players.delete(id);
    this.playerInputs.delete(id);
    if (this.reloadTimers.has(id)) {
      clearTimeout(this.reloadTimers.get(id)!);
      this.reloadTimers.delete(id);
    }
    if (this.spawnProtectionTimers.has(id)) {
      clearTimeout(this.spawnProtectionTimers.get(id)!);
      this.spawnProtectionTimers.delete(id);
    }
  }

  setPlayerReady(id: string, ready: boolean): void {
    const player = this.lobbyPlayers.get(id);
    if (player) {
      player.ready = ready;
    }
  }

  setPlayerLoadoutReady(id: string, ready: boolean): void {
    const player = this.lobbyPlayers.get(id);
    if (player) {
      player.loadoutReady = ready;
    }

    // Check if all players are loadout ready
    if (ready) {
      this.checkAllLoadoutReady();
    }
  }

  private checkAllLoadoutReady(): void {
    if (this.lobbyPlayers.size < 2) return;
    const allReady = Array.from(this.lobbyPlayers.values()).every(p => p.loadoutReady);
    if (allReady && this.inLoadoutPhase) {
      this.startGameFromLoadout();
    }
  }

  private startGameFromLoadout(): void {
    if (this.countdownStarted) return;
    this.countdownStarted = true;
    this.gameStarted = true;

    let countdown = 3;
    this.io.to(this.code).emit('game:starting', countdown);

    this.countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        this.io.to(this.code).emit('game:starting', countdown);
      } else {
        clearInterval(this.countdownInterval!);
        this.countdownInterval = null;
        this.io.to(this.code).emit('game:started');
        this.startGameLoop();
      }
    }, 1000);
  }

  getFirstPlayerId(): string | undefined {
    return this.lobbyPlayers.keys().next().value;
  }

  getInfo(): RoomInfo {
    return {
      code: this.code,
      hostId: this.hostId,
      players: Array.from(this.lobbyPlayers.values()),
      maxPlayers: 4,
      gameStarted: this.gameStarted,
      inLoadoutPhase: this.inLoadoutPhase
    };
  }

  setPlayerLoadout(id: string, movement: MovementType, weapon: WeaponType): void {
    // Update lobby player loadout selection
    const lobbyPlayer = this.lobbyPlayers.get(id);
    if (lobbyPlayer) {
      lobbyPlayer.movement = movement;
      lobbyPlayer.weapon = weapon;
    }

    // Also update game player if exists
    const player = this.players.get(id);
    if (player) {
      player.movement = movement;
      player.weapon = weapon;

      // Update fuel based on movement type
      const stats = MOVEMENT_STATS[movement];
      player.maxFuel = stats.fuel;
      player.fuel = stats.fuel;

      // Reset ammo for new weapon
      player.ammo = WEAPON_STATS[weapon].clipSize;
      player.isReloading = false;
      if (this.reloadTimers.has(id)) {
        clearTimeout(this.reloadTimers.get(id)!);
        this.reloadTimers.delete(id);
      }
    }
  }

  startGame(): boolean {
    if (this.gameStarted || this.inLoadoutPhase) return false;

    // Check if all players are ready
    const allReady = Array.from(this.lobbyPlayers.values()).every(p => p.ready);
    if (!allReady) {
      console.log('Cannot start: not all players are ready');
      return false;
    }

    if (this.lobbyPlayers.size < 2) {
      console.log('Cannot start: need at least 2 players');
      return false;
    }

    // Enter loadout phase - reset loadout ready status
    this.inLoadoutPhase = true;
    for (const player of this.lobbyPlayers.values()) {
      player.loadoutReady = false;
    }

    // Initialize players for the game
    this.initializePlayers();

    // Notify clients to go to loadout scene
    this.io.to(this.code).emit('loadout:phase');
    this.io.to(this.code).emit('room:updated', this.getInfo());

    return true;
  }

  private initializePlayers(): void {
    let playerIndex = 0;
    const arena = ARENAS[ArenaId.CENTER];

    for (const [id, lobbyPlayer] of this.lobbyPlayers) {
      // Each player gets their own spawn point in the arena
      const spawn = arena.spawnPoints[playerIndex % arena.spawnPoints.length];

      const movementStats = MOVEMENT_STATS[lobbyPlayer.movement];
      const player: PlayerState = {
        id,
        name: lobbyPlayer.name,
        x: spawn.x,
        y: spawn.y,
        z: DEFAULT_Z,
        velocityX: 0,
        velocityY: 0,
        velocityZ: 0,
        angle: 0,
        health: MAX_HEALTH,
        maxHealth: MAX_HEALTH,
        fuel: movementStats.fuel,
        maxFuel: movementStats.fuel,
        currentArena: ArenaId.CENTER,
        movement: lobbyPlayer.movement,
        weapon: lobbyPlayer.weapon,
        isInSpawn: false,
        isDead: false,
        kills: 0,
        deaths: 0,
        color: PLAYER_COLORS[playerIndex],
        ammo: WEAPON_STATS[lobbyPlayer.weapon].clipSize,
        isReloading: false
      };

      this.players.set(id, player);
      playerIndex++;
    }

    // Initialise breakable obstacles from arena definition
    this.obstacles.clear();
    for (const obs of arena.breakableObstacles) {
      this.obstacles.set(obs.id, {
        id: obs.id,
        x: obs.x,
        y: obs.y,
        width: obs.width,
        height: obs.height,
        health: obs.health,
        maxHealth: obs.health
      });
    }
  }

  handleInput(playerId: string, input: InputState): void {
    this.playerInputs.set(playerId, input);
  }

  private startGameLoop(): void {
    // Grant spawn protection to all players at game start
    for (const player of this.players.values()) {
      this.grantSpawnProtection(player);
    }

    const tickInterval = 1000 / TICK_RATE;

    this.gameLoop = setInterval(() => {
      this.update();
      this.broadcastState();
      this.tick++;
    }, tickInterval);
  }

  private update(): void {
    // Update all players
    for (const [id, player] of this.players) {
      if (player.isDead) continue;

      const input = this.playerInputs.get(id);
      if (input) {
        this.updatePlayer(player, input);
      }
    }

    // Update projectiles
    this.updateProjectiles();

    // Check collisions
    this.checkCollisions();
  }

  private updatePlayer(player: PlayerState, input: InputState): void {
    const stats = MOVEMENT_STATS[player.movement];

    // Update facing angle
    player.angle = input.mouseAngle;

    // Horizontal movement
    let targetVelX = 0;
    let targetVelY = 0;

    if (input.left) targetVelX -= stats.speed;
    if (input.right) targetVelX += stats.speed;
    if (input.up) targetVelY -= stats.speed;
    if (input.down) targetVelY += stats.speed;

    // Normalize diagonal movement
    if (targetVelX !== 0 && targetVelY !== 0) {
      const factor = 1 / Math.sqrt(2);
      targetVelX *= factor;
      targetVelY *= factor;
    }

    // Apply acceleration
    player.velocityX += (targetVelX - player.velocityX) * stats.acceleration;
    player.velocityY += (targetVelY - player.velocityY) * stats.acceleration;

    // Apply friction
    player.velocityX *= stats.friction;
    player.velocityY *= stats.friction;

    // Vertical movement (Z-axis)
    const isGrounded = player.z <= MIN_Z + 5;
    let wantsToAscend = input.jump;
    let wantsToDescend = input.crouch;

    // Handle fuel for jetpacks
    if (stats.fuel > 0) {
      if (wantsToAscend && player.fuel > 0) {
        player.fuel = Math.max(0, player.fuel - stats.fuelDrain);
      } else if (wantsToAscend && player.fuel <= 0) {
        wantsToAscend = false;  // Out of fuel
      }

      // Regenerate fuel when grounded
      if (isGrounded && !wantsToAscend) {
        player.fuel = Math.min(stats.fuel, player.fuel + stats.fuelRegen);
      }
    }

    // Calculate vertical velocity
    if (wantsToAscend) {
      player.velocityZ = stats.zClimbRate;
    } else if (wantsToDescend) {
      player.velocityZ = -stats.zClimbRate;
    } else if (stats.canHover) {
      player.velocityZ = 0;  // Hover in place
    } else {
      // Apply gravity/glide
      const isMoving = Math.abs(player.velocityX) > 0.5 || Math.abs(player.velocityY) > 0.5;
      const fallRate = player.movement === MovementType.WINGS
        ? (isMoving ? stats.zFallRate : GRAVITY)  // Wings glide when moving, fall when stationary
        : stats.zFallRate;
      player.velocityZ = -fallRate;
    }

    // Apply velocity to position
    player.x += player.velocityX;
    player.y += player.velocityY;
    player.z = Math.max(MIN_Z, Math.min(MAX_Z, player.z + player.velocityZ));

    // Arena boundary collision
    const arena = ARENAS[player.currentArena];
    player.x = Math.max(PLAYER_RADIUS, Math.min(arena.width - PLAYER_RADIUS, player.x));
    player.y = Math.max(PLAYER_RADIUS, Math.min(arena.height - PLAYER_RADIUS, player.y));

    // Wall collision
    for (const wall of arena.walls) {
      if (this.rectCircleCollision(wall, player.x, player.y, PLAYER_RADIUS)) {
        // Push player out of wall
        const centerX = wall.x + wall.width / 2;
        const centerY = wall.y + wall.height / 2;
        const angle = Math.atan2(player.y - centerY, player.x - centerX);
        player.x = centerX + Math.cos(angle) * (wall.width / 2 + PLAYER_RADIUS + 1);
        player.y = centerY + Math.sin(angle) * (wall.height / 2 + PLAYER_RADIUS + 1);
      }
    }

    // Handle shooting (no spawn protection in single arena mode)
    if (input.shooting) {
      this.tryShoot(player);
    }
  }

  private tryShoot(player: PlayerState): void {
    if (player.ammo <= 0 || player.isReloading) return;

    const weaponStats = WEAPON_STATS[player.weapon];
    const now = Date.now();
    const lastShot = this.lastShotTime.get(player.id) || 0;
    const cooldown = 1000 / weaponStats.fireRate;

    if (now - lastShot < cooldown) return;

    // Security: Limit projectiles per player to prevent memory exhaustion
    const playerProjectileCount = Array.from(this.projectiles.values())
      .filter(p => p.ownerId === player.id).length;
    if (playerProjectileCount >= MAX_PROJECTILES_PER_PLAYER) return;

    this.lastShotTime.set(player.id, now);
    player.ammo--;

    if (player.ammo <= 0) {
      this.startReload(player);
    }

    // Add spread to angle
    const spread = (Math.random() - 0.5) * weaponStats.spread;
    const angle = player.angle + spread;

    // Handle hitscan weapons (sniper)
    if (weaponStats.isHitscan) {
      this.handleHitscan(player, angle, weaponStats.damage, weaponStats.range);
      return;
    }

    // Create projectile
    const projectile: ProjectileState = {
      id: `proj_${this.projectileIdCounter++}`,
      ownerId: player.id,
      x: player.x + Math.cos(angle) * (PLAYER_RADIUS + 5),
      y: player.y + Math.sin(angle) * (PLAYER_RADIUS + 5),
      z: player.z,
      angle,
      speed: weaponStats.projectileSpeed,
      damage: weaponStats.damage,
      type: player.weapon,
      arena: player.currentArena,
      createdAt: now
    };

    this.projectiles.set(projectile.id, projectile);
  }

  private startReload(player: PlayerState): void {
    player.isReloading = true;
    const weaponStats = WEAPON_STATS[player.weapon];
    const reloadDuration = (weaponStats.reloadTime / TICK_RATE) * 1000;

    const timer = setTimeout(() => {
      if (player.isDead) return;
      player.isReloading = false;
      player.ammo = weaponStats.clipSize;
      this.reloadTimers.delete(player.id);
    }, reloadDuration);

    this.reloadTimers.set(player.id, timer);
  }

  private handleHitscan(player: PlayerState, angle: number, damage: number, range: number): void {
    const startX = player.x;
    const startY = player.y;
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);
    const arena = ARENAS[player.currentArena];

    // Find the nearest obstacle (solid or breakable) along the ray
    let closestObsDist = range;
    let hitBreakableId: string | null = null;

    // Solid walls block hitscan completely
    for (const wall of arena.walls) {
      const t = this.rayRectIntersect(startX, startY, dirX, dirY, wall);
      if (t !== null && t > 0 && t < closestObsDist) {
        closestObsDist = t;
        hitBreakableId = null;  // solid — no damage to obstacle
      }
    }

    // Breakable obstacles block hitscan and take damage
    for (const [obsId, obs] of this.obstacles) {
      const t = this.rayRectIntersect(startX, startY, dirX, dirY, obs);
      if (t !== null && t > 0 && t < closestObsDist) {
        closestObsDist = t;
        hitBreakableId = obsId;
      }
    }

    // Find closest player hit
    let closestHit: PlayerState | null = null;
    let closestPlayerDist = closestObsDist;  // can't be farther than nearest obstacle

    for (const [, target] of this.players) {
      if (target.id === player.id) continue;
      if (target.isDead) continue;
      if (target.currentArena !== player.currentArena) continue;
      if (target.isInSpawn) continue;
      if (Math.abs(target.z - player.z) > Z_HIT_TOLERANCE) continue;

      // Ray-circle intersection
      const dx = target.x - startX;
      const dy = target.y - startY;
      const a = dirX * dirX + dirY * dirY;
      const b = 2 * (dirX * (-dx) + dirY * (-dy));
      const c = dx * dx + dy * dy - PLAYER_RADIUS * PLAYER_RADIUS;
      const discriminant = b * b - 4 * a * c;

      if (discriminant >= 0) {
        const t = (-b - Math.sqrt(discriminant)) / (2 * a);
        if (t > 0 && t < closestPlayerDist) {
          closestPlayerDist = t;
          closestHit = target;
        }
      }
    }

    // Calculate end point for the hitscan visual
    const endDist = closestHit ? closestPlayerDist : closestObsDist;
    const endX = startX + dirX * endDist;
    const endY = startY + dirY * endDist;

    // Emit hitscan event for visual effect
    this.io.to(this.code).emit('game:hitscan', {
      sourceId: player.id,
      startX,
      startY,
      endX,
      endY
    });

    if (closestHit) {
      // Player was hit before any obstacle
      this.damagePlayer(closestHit, damage, player.id);
      this.io.to(this.code).emit('game:hit', {
        targetId: closestHit.id,
        damage: damage,
        sourceId: player.id
      });
    } else if (hitBreakableId) {
      // Ray hit a breakable obstacle (no player in front of it)
      const obs = this.obstacles.get(hitBreakableId);
      if (obs) {
        obs.health -= damage;
        if (obs.health <= 0) {
          this.obstacles.delete(hitBreakableId);
        }
      }
    }
  }

  manualReload(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || player.isDead || player.isReloading) return;

    const weaponStats = WEAPON_STATS[player.weapon];
    if (player.ammo >= weaponStats.clipSize) return; // Already full

    this.startReload(player);
  }

  // Ray-AABB intersection — returns distance t along ray or null if no hit
  private rayRectIntersect(
    ox: number, oy: number, dx: number, dy: number,
    rect: { x: number; y: number; width: number; height: number }
  ): number | null {
    const invDx = dx === 0 ? Infinity : 1 / dx;
    const invDy = dy === 0 ? Infinity : 1 / dy;

    let tMin = (rect.x - ox) * invDx;
    let tMax = (rect.x + rect.width - ox) * invDx;
    if (tMin > tMax) { const tmp = tMin; tMin = tMax; tMax = tmp; }

    let tyMin = (rect.y - oy) * invDy;
    let tyMax = (rect.y + rect.height - oy) * invDy;
    if (tyMin > tyMax) { const tmp = tyMin; tyMin = tyMax; tyMax = tmp; }

    const tEnter = Math.max(tMin, tyMin);
    const tExit = Math.min(tMax, tyMax);

    if (tEnter > tExit || tExit < 0) return null;
    return tEnter > 0 ? tEnter : tExit;
  }

  private updateProjectiles(): void {
    const now = Date.now();

    for (const [id, proj] of this.projectiles) {
      // Move projectile
      proj.x += Math.cos(proj.angle) * proj.speed;
      proj.y += Math.sin(proj.angle) * proj.speed;

      // Check if out of bounds or too old
      const arena = ARENAS[proj.arena];
      const age = now - proj.createdAt;
      const maxAge = 5000;  // 5 seconds max lifetime

      if (proj.x < 0 || proj.x > arena.width ||
          proj.y < 0 || proj.y > arena.height ||
          age > maxAge) {
        this.projectiles.delete(id);
        continue;
      }

      // Check solid wall collision
      let hitSolid = false;
      for (const wall of arena.walls) {
        if (this.pointInRect(proj.x, proj.y, wall.x, wall.y, wall.width, wall.height)) {
          this.projectiles.delete(id);
          hitSolid = true;
          break;
        }
      }
      if (hitSolid) continue;

      // Check breakable obstacle collision
      for (const [obsId, obs] of this.obstacles) {
        if (this.pointInRect(proj.x, proj.y, obs.x, obs.y, obs.width, obs.height)) {
          obs.health -= proj.damage;
          if (obs.health <= 0) {
            this.obstacles.delete(obsId);
          }
          this.projectiles.delete(id);
          break;
        }
      }
    }
  }

  private checkCollisions(): void {
    for (const [projId, proj] of this.projectiles) {
      for (const [, player] of this.players) {
        if (player.id === proj.ownerId) continue;
        if (player.isDead) continue;
        if (player.currentArena !== proj.arena) continue;
        if (player.isInSpawn) continue;

        // Check Z difference
        if (Math.abs(player.z - proj.z) > Z_HIT_TOLERANCE) continue;

        // Circle collision
        const dx = player.x - proj.x;
        const dy = player.y - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PLAYER_RADIUS) {
          this.damagePlayer(player, proj.damage, proj.ownerId);
          this.io.to(this.code).emit('game:hit', {
            targetId: player.id,
            damage: proj.damage,
            sourceId: proj.ownerId
          });

          this.projectiles.delete(projId);
          break;
        }
      }
    }
  }

  private damagePlayer(player: PlayerState, damage: number, sourceId: string): void {
    player.health -= damage;

    if (player.health <= 0) {
      player.health = 0;
      player.isDead = true;
      player.deaths++;

      const source = this.players.get(sourceId);
      if (source) {
        source.kills++;
      }

      this.io.to(this.code).emit('game:kill', {
        killerId: sourceId,
        victimId: player.id
      });

      // Check win condition
      if (source && source.kills >= KILL_LIMIT) {
        this.endGame(source.id);
      }
    }
  }

  private endGame(winnerId: string): void {
    // Stop the game loop immediately
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }

    // Build final scores
    const scores: Record<string, { kills: number; deaths: number }> = {};
    for (const [id, player] of this.players) {
      scores[id] = { kills: player.kills, deaths: player.deaths };
    }

    // Broadcast game ended
    this.io.to(this.code).emit('game:ended', { winnerId, scores });

    // Reset room state so players can rematch from the lobby
    this.gameStarted = false;
    this.inLoadoutPhase = false;
    this.countdownStarted = false;
    this.players.clear();
    this.projectiles.clear();
    this.obstacles.clear();
    this.playerInputs.clear();
    this.lastShotTime.clear();
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();
    for (const timer of this.spawnProtectionTimers.values()) {
      clearTimeout(timer);
    }
    this.spawnProtectionTimers.clear();

    // Reset lobby player states for a fresh round
    for (const lobbyPlayer of this.lobbyPlayers.values()) {
      lobbyPlayer.ready = false;
      lobbyPlayer.loadoutReady = false;
    }

    // Broadcast updated room info after a short delay (so clients land in lobby first)
    setTimeout(() => {
      this.io.to(this.code).emit('room:updated', this.getInfo());
    }, 200);
  }

  respawnPlayer(playerId: string): void {
    const player = this.players.get(playerId);
    if (!player || !player.isDead) return;

    // Respawn in CENTER arena
    const playerIndex = Array.from(this.players.keys()).indexOf(playerId);
    const arena = ARENAS[ArenaId.CENTER];
    const spawn = arena.spawnPoints[playerIndex % arena.spawnPoints.length];

    player.x = spawn.x;
    player.y = spawn.y;
    player.z = DEFAULT_Z;
    player.velocityX = 0;
    player.velocityY = 0;
    player.velocityZ = 0;
    player.health = MAX_HEALTH;
    player.fuel = player.maxFuel;
    player.currentArena = ArenaId.CENTER;
    player.isDead = false;
    player.ammo = WEAPON_STATS[player.weapon].clipSize;
    player.isReloading = false;
    if (this.reloadTimers.has(playerId)) {
      clearTimeout(this.reloadTimers.get(playerId)!);
      this.reloadTimers.delete(playerId);
    }

    this.grantSpawnProtection(player);
  }

  private grantSpawnProtection(player: PlayerState): void {
    player.isInSpawn = true;
    if (this.spawnProtectionTimers.has(player.id)) {
      clearTimeout(this.spawnProtectionTimers.get(player.id)!);
    }
    const timer = setTimeout(() => {
      player.isInSpawn = false;
      this.spawnProtectionTimers.delete(player.id);
    }, 3000);
    this.spawnProtectionTimers.set(player.id, timer);
  }

  private broadcastState(): void {
    const state: GameState = {
      players: Object.fromEntries(this.players),
      projectiles: Array.from(this.projectiles.values()),
      obstacles: Array.from(this.obstacles.values()),
      timestamp: Date.now(),
      tick: this.tick
    };

    this.io.to(this.code).emit('game:state', state);
  }

  // Collision helpers
  private rectCircleCollision(
    rect: { x: number; y: number; width: number; height: number },
    cx: number, cy: number, r: number
  ): boolean {
    const nearestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
    const nearestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
    const dx = cx - nearestX;
    const dy = cy - nearestY;
    return dx * dx + dy * dy < r * r;
  }

  private pointInRect(px: number, py: number, rx: number, ry: number, rw: number, rh: number): boolean {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  destroy(): void {
    if (this.gameLoop) {
      clearInterval(this.gameLoop);
      this.gameLoop = null;
    }
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    for (const timer of this.reloadTimers.values()) {
      clearTimeout(timer);
    }
    this.reloadTimers.clear();
    for (const timer of this.spawnProtectionTimers.values()) {
      clearTimeout(timer);
    }
    this.spawnProtectionTimers.clear();
    this.players.clear();
    this.projectiles.clear();
    this.obstacles.clear();
    this.playerInputs.clear();
    this.lobbyPlayers.clear();
  }
}
