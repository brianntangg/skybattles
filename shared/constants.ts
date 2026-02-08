// ============================================
// Sky Battles - Game Constants & Balance Values
// Central location for all game tuning
// ============================================

import { MovementType, WeaponType, ArenaId, ArenaDefinition } from './types';

// ===================
// GAME SETTINGS
// ===================
export const GAME_WIDTH = 1024;
export const GAME_HEIGHT = 768;
export const TICK_RATE = 20;  // Server updates per second (50ms tick)
export const MAX_PLAYERS = 4;
export const PLAYER_RADIUS = 20;
export const MAX_HEALTH = 100;
export const KILL_LIMIT = 11;  // First to 11 kills wins

// ===================
// Z-AXIS (ALTITUDE)
// ===================
export const MIN_Z = 0;
export const MAX_Z = 100;
export const DEFAULT_Z = 20;
export const Z_HIT_TOLERANCE = 15;  // Players within ±15 z-units can hit each other
export const GRAVITY = 0.5;  // Z fall rate per tick when not thrusting
export const WALL_MAX_Z = 80;  // Walls extend up to this altitude; players above can fly over

// ===================
// MOVEMENT STATS
// ===================
export interface MovementStats {
  speed: number;           // Horizontal movement speed
  acceleration: number;    // How fast to reach max speed
  friction: number;        // Deceleration when not moving
  zClimbRate: number;      // How fast can ascend
  zFallRate: number;       // How fast falls (0 = hover)
  fuel: number;            // Max fuel (0 = infinite)
  fuelDrain: number;       // Fuel consumed per tick when thrusting
  fuelRegen: number;       // Fuel regenerated per tick when grounded
  canHover: boolean;       // Can maintain altitude without fuel
}

export const MOVEMENT_STATS: Record<MovementType, MovementStats> = {
  [MovementType.WINGS]: {
    speed: 8,              // Fastest horizontal
    acceleration: 0.6,
    friction: 0.92,
    zClimbRate: 1,         // Slow climb
    zFallRate: 0.3,        // Glides well when moving
    fuel: 0,               // No fuel
    fuelDrain: 0,
    fuelRegen: 0,
    canHover: false
  },
  [MovementType.FIRE_JETPACK]: {
    speed: 5,
    acceleration: 0.8,
    friction: 0.88,
    zClimbRate: 5,         // Fastest vertical
    zFallRate: 2,          // Falls fast
    fuel: 100,
    fuelDrain: 3,          // Burns fuel quickly
    fuelRegen: 1.5,        // Moderate regen when grounded
    canHover: false
  },
  [MovementType.WATER_JETPACK]: {
    speed: 5,
    acceleration: 0.5,
    friction: 0.9,
    zClimbRate: 2,         // Medium climb
    zFallRate: 1,          // Slow fall
    fuel: 100,
    fuelDrain: 1,          // Efficient fuel use
    fuelRegen: 2.5,        // Fast regen when grounded
    canHover: true         // Can hover in place
  },
  [MovementType.LEVITATION]: {
    speed: 3,              // Slowest
    acceleration: 0.3,
    friction: 0.95,
    zClimbRate: 1,
    zFallRate: 0,          // No passive fall - perfect control
    fuel: 0,               // No fuel
    fuelDrain: 0,
    fuelRegen: 0,
    canHover: true
  }
};

// ===================
// WEAPON STATS
// ===================
export interface WeaponStats {
  damage: number;
  fireRate: number;        // Shots per second
  projectileSpeed: number; // Pixels per tick
  range: number;           // Max distance in pixels
  spread: number;          // Accuracy (0 = perfect, higher = more spread)
  clipSize: number;        // Ammo before reload
  reloadTime: number;      // Ticks to reload
  isHitscan: boolean;      // Instant hit (sniper)
}

export const WEAPON_STATS: Record<WeaponType, WeaponStats> = {
  [WeaponType.MACHINE_GUN]: {
    damage: 8,
    fireRate: 10,          // 10 rounds/sec
    projectileSpeed: 15,
    range: 400,
    spread: 0.1,
    clipSize: 30,
    reloadTime: 40,        // 2 seconds at 20 ticks/sec
    isHitscan: false
  },
  [WeaponType.PULSE_LASER]: {
    damage: 25,
    fireRate: 2,           // 2 rounds/sec
    projectileSpeed: 20,
    range: 600,
    spread: 0,             // Perfect accuracy
    clipSize: 8,
    reloadTime: 30,
    isHitscan: false
  },
  [WeaponType.SNIPER]: {
    damage: 100,           // One-shot kill
    fireRate: 0.5,         // 2 second between shots
    projectileSpeed: 0,    // Hitscan
    range: 1000,
    spread: 0,
    clipSize: 1,
    reloadTime: 40,
    isHitscan: true
  },
  [WeaponType.ROCKET]: {
    damage: 50,
    fireRate: 1,           // 1 rocket/sec
    projectileSpeed: 12,
    range: 600,
    spread: 0,             // Perfect accuracy
    clipSize: 4,
    reloadTime: 50,
    isHitscan: false
  }
};

// Weapon visual colors
export const WEAPON_COLORS: Record<WeaponType, number> = {
  [WeaponType.MACHINE_GUN]: 0xFFFF00,   // Yellow bullets
  [WeaponType.PULSE_LASER]: 0x00BFFF,   // Blue laser
  [WeaponType.SNIPER]: 0xFF0000,        // Red line
  [WeaponType.ROCKET]: 0xFF6600         // Orange rockets
};

// ===================
// PLAYER COLORS
// ===================
export const PLAYER_COLORS = [
  0xE74C3C,  // Red
  0x3498DB,  // Blue
  0x2ECC71,  // Green
  0xF39C12   // Orange
];

// ===================
// ARENA DEFINITIONS
// ===================
export const ARENA_SIZE = { width: GAME_WIDTH, height: GAME_HEIGHT };

// Generate arena layouts
export const ARENAS: Record<ArenaId, ArenaDefinition> = {
  // Center Arena - "Battle Arena" - Single arena for all players
  [ArenaId.CENTER]: {
    id: ArenaId.CENTER,
    name: 'Battle Arena',
    width: ARENA_SIZE.width,
    height: ARENA_SIZE.height,
    walls: [
      // Central solid obstacle
      { x: 462, y: 334, width: 100, height: 100 },
    ],
    breakableObstacles: [
      // Corner pillars (breakable)
      { id: 'center_nw', x: 200, y: 200, width: 60, height: 60, health: 50 },
      { id: 'center_ne', x: 764, y: 200, width: 60, height: 60, health: 50 },
      { id: 'center_sw', x: 200, y: 508, width: 60, height: 60, health: 50 },
      { id: 'center_se', x: 764, y: 508, width: 60, height: 60, health: 50 },
      // Mid-lane breakable barriers
      { id: 'center_mid_top', x: 350, y: 150, width: 80, height: 40, health: 35 },
      { id: 'center_mid_bot', x: 594, y: 578, width: 80, height: 40, health: 35 },
    ],
    platforms: [
      // Elevated central platform
      { x: 412, y: 284, width: 200, height: 200, minZ: 40, maxZ: 60 }
    ],
    spawnPoints: [
      { x: 100, y: 100 },   // Top-left
      { x: 924, y: 100 },   // Top-right
      { x: 100, y: 668 },   // Bottom-left
      { x: 924, y: 668 }    // Bottom-right
    ],
    doors: []  // No doors - single arena
  },

  // Top Arena - "The Towers" - Vertical structures
  [ArenaId.TOP]: {
    id: ArenaId.TOP,
    name: 'The Towers',
    width: ARENA_SIZE.width,
    height: ARENA_SIZE.height,
    walls: [
      // Tall towers
      { x: 150, y: 100, width: 60, height: 500 },
      { x: 400, y: 200, width: 60, height: 400 },
      { x: 600, y: 100, width: 60, height: 500 },
      { x: 850, y: 200, width: 60, height: 400 }
    ],
    breakableObstacles: [],
    platforms: [
      // High platforms on towers
      { x: 130, y: 80, width: 100, height: 40, minZ: 60, maxZ: 80 },
      { x: 380, y: 180, width: 100, height: 40, minZ: 50, maxZ: 70 },
      { x: 580, y: 80, width: 100, height: 40, minZ: 60, maxZ: 80 },
      { x: 830, y: 180, width: 100, height: 40, minZ: 50, maxZ: 70 }
    ],
    spawnPoints: [
      { x: 50, y: 700 },
      { x: 974, y: 700 }
    ],
    doors: [
      { from: ArenaId.TOP, to: ArenaId.CENTER, x: 462, y: 748, width: 100, height: 20 }
    ]
  },

  // Bottom Arena - "The Tunnels" - Low ceiling corridors
  [ArenaId.BOTTOM]: {
    id: ArenaId.BOTTOM,
    name: 'The Tunnels',
    width: ARENA_SIZE.width,
    height: ARENA_SIZE.height,
    walls: [
      // Corridor walls creating maze
      { x: 200, y: 0, width: 40, height: 300 },
      { x: 200, y: 400, width: 40, height: 368 },
      { x: 400, y: 100, width: 40, height: 400 },
      { x: 600, y: 268, width: 40, height: 500 },
      { x: 800, y: 0, width: 40, height: 400 },
      { x: 800, y: 500, width: 40, height: 268 }
    ],
    breakableObstacles: [],
    platforms: [],  // No elevated platforms - tunnels favor horizontal
    spawnPoints: [
      { x: 100, y: 384 },
      { x: 924, y: 384 }
    ],
    doors: [
      { from: ArenaId.BOTTOM, to: ArenaId.CENTER, x: 462, y: 0, width: 100, height: 20 }
    ]
  },

  // Left Arena - "The Cliffs" - Asymmetric high ground
  [ArenaId.LEFT]: {
    id: ArenaId.LEFT,
    name: 'The Cliffs',
    width: ARENA_SIZE.width,
    height: ARENA_SIZE.height,
    walls: [
      // Cliff face
      { x: 0, y: 300, width: 400, height: 40 },
      { x: 300, y: 340, width: 100, height: 200 }
    ],
    breakableObstacles: [],
    platforms: [
      // High cliff platform
      { x: 0, y: 100, width: 400, height: 200, minZ: 50, maxZ: 100 },
      // Lower stepping stones
      { x: 500, y: 400, width: 150, height: 100, minZ: 30, maxZ: 50 },
      { x: 700, y: 550, width: 150, height: 100, minZ: 20, maxZ: 40 }
    ],
    spawnPoints: [
      { x: 200, y: 200 },
      { x: 800, y: 650 }
    ],
    doors: [
      { from: ArenaId.LEFT, to: ArenaId.CENTER, x: 1004, y: 334, width: 20, height: 100 }
    ]
  },

  // Right Arena - "The Maze" - Tight corners, cover-heavy
  [ArenaId.RIGHT]: {
    id: ArenaId.RIGHT,
    name: 'The Maze',
    width: ARENA_SIZE.width,
    height: ARENA_SIZE.height,
    walls: [
      // Maze walls
      { x: 150, y: 150, width: 200, height: 40 },
      { x: 150, y: 150, width: 40, height: 200 },
      { x: 450, y: 100, width: 40, height: 300 },
      { x: 450, y: 100, width: 200, height: 40 },
      { x: 650, y: 100, width: 40, height: 200 },
      { x: 200, y: 450, width: 300, height: 40 },
      { x: 200, y: 450, width: 40, height: 200 },
      { x: 600, y: 400, width: 40, height: 300 },
      { x: 600, y: 400, width: 200, height: 40 },
      { x: 750, y: 550, width: 200, height: 40 }
    ],
    breakableObstacles: [],
    platforms: [],  // No elevation - pure cover gameplay
    spawnPoints: [
      { x: 80, y: 80 },
      { x: 944, y: 688 }
    ],
    doors: [
      { from: ArenaId.RIGHT, to: ArenaId.CENTER, x: 0, y: 334, width: 20, height: 100 }
    ]
  },

  // Spawn rooms - Safe zones
  [ArenaId.SPAWN_NW]: {
    id: ArenaId.SPAWN_NW,
    name: 'Northwest Spawn',
    width: 200,
    height: 200,
    walls: [],
    breakableObstacles: [],
    platforms: [],
    spawnPoints: [{ x: 100, y: 100 }],
    doors: [
      { from: ArenaId.SPAWN_NW, to: ArenaId.LEFT, x: 180, y: 80, width: 20, height: 40 },
      { from: ArenaId.SPAWN_NW, to: ArenaId.TOP, x: 80, y: 180, width: 40, height: 20 }
    ]
  },
  [ArenaId.SPAWN_NE]: {
    id: ArenaId.SPAWN_NE,
    name: 'Northeast Spawn',
    width: 200,
    height: 200,
    walls: [],
    breakableObstacles: [],
    platforms: [],
    spawnPoints: [{ x: 100, y: 100 }],
    doors: [
      { from: ArenaId.SPAWN_NE, to: ArenaId.RIGHT, x: 0, y: 80, width: 20, height: 40 },
      { from: ArenaId.SPAWN_NE, to: ArenaId.TOP, x: 80, y: 180, width: 40, height: 20 }
    ]
  },
  [ArenaId.SPAWN_SW]: {
    id: ArenaId.SPAWN_SW,
    name: 'Southwest Spawn',
    width: 200,
    height: 200,
    walls: [],
    breakableObstacles: [],
    platforms: [],
    spawnPoints: [{ x: 100, y: 100 }],
    doors: [
      { from: ArenaId.SPAWN_SW, to: ArenaId.LEFT, x: 180, y: 80, width: 20, height: 40 },
      { from: ArenaId.SPAWN_SW, to: ArenaId.BOTTOM, x: 80, y: 0, width: 40, height: 20 }
    ]
  },
  [ArenaId.SPAWN_SE]: {
    id: ArenaId.SPAWN_SE,
    name: 'Southeast Spawn',
    width: 200,
    height: 200,
    walls: [],
    breakableObstacles: [],
    platforms: [],
    spawnPoints: [{ x: 100, y: 100 }],
    doors: [
      { from: ArenaId.SPAWN_SE, to: ArenaId.RIGHT, x: 0, y: 80, width: 20, height: 40 },
      { from: ArenaId.SPAWN_SE, to: ArenaId.BOTTOM, x: 80, y: 0, width: 40, height: 20 }
    ]
  }
};

// ===================
// NETWORKING
// ===================
export const SERVER_PORT = 3000;
export const ROOM_CODE_LENGTH = 4;
