// ============================================
// Sky Battles - Shared Types
// Used by both client and server
// ============================================

// Movement types - each has unique aerial characteristics
export enum MovementType {
  WINGS = 'wings',
  FIRE_JETPACK = 'fire_jetpack',
  WATER_JETPACK = 'water_jetpack',
  LEVITATION = 'levitation'
}

// Weapon types - balanced for different playstyles
export enum WeaponType {
  MACHINE_GUN = 'machine_gun',
  PULSE_LASER = 'pulse_laser',
  SNIPER = 'sniper',
  ROCKET = 'rocket'
}

// Arena identifiers - cross-shaped layout
export enum ArenaId {
  CENTER = 'center',
  TOP = 'top',
  BOTTOM = 'bottom',
  LEFT = 'left',
  RIGHT = 'right',
  SPAWN_NW = 'spawn_nw',
  SPAWN_NE = 'spawn_ne',
  SPAWN_SW = 'spawn_sw',
  SPAWN_SE = 'spawn_se'
}

// Player state synchronized across network
export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;  // Altitude (0-100)
  velocityX: number;
  velocityY: number;
  velocityZ: number;
  angle: number;  // Facing direction in radians
  health: number;
  maxHealth: number;
  fuel: number;
  maxFuel: number;
  currentArena: ArenaId;
  movement: MovementType;
  weapon: WeaponType;
  isInSpawn: boolean;
  isDead: boolean;
  kills: number;
  deaths: number;
  color: number;  // Player color hex
  ammo: number;
  isReloading: boolean;
}

// Projectile state for bullets/lasers
export interface ProjectileState {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  z: number;
  angle: number;
  speed: number;
  damage: number;
  type: WeaponType;
  arena: ArenaId;
  createdAt: number;
}

// Input state sent from client to server
export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;    // Ascend
  crouch: boolean;  // Descend
  shooting: boolean;
  mouseAngle: number;
  timestamp: number;
  sequence: number;
}

// Live state of a breakable obstacle
export interface BreakableObstacle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
}

// Game state broadcast from server
export interface GameState {
  players: Record<string, PlayerState>;
  projectiles: ProjectileState[];
  obstacles: BreakableObstacle[];
  timestamp: number;
  tick: number;
}

// Room player info
export interface RoomPlayer {
  id: string;
  name: string;
  ready: boolean;
  loadoutReady: boolean;
  movement: MovementType;
  weapon: WeaponType;
}

// Room information
export interface RoomInfo {
  code: string;
  hostId: string;
  players: RoomPlayer[];
  maxPlayers: number;
  gameStarted: boolean;
  inLoadoutPhase: boolean;
}

// Arena door connection
export interface ArenaDoor {
  from: ArenaId;
  to: ArenaId;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Arena definition
export interface ArenaDefinition {
  id: ArenaId;
  name: string;
  width: number;
  height: number;
  walls: { x: number; y: number; width: number; height: number }[];
  breakableObstacles: { id: string; x: number; y: number; width: number; height: number; health: number }[];
  platforms: { x: number; y: number; width: number; height: number; minZ: number; maxZ: number }[];
  spawnPoints: { x: number; y: number }[];
  doors: ArenaDoor[];
}

// Network events - Client to Server
export interface ClientToServerEvents {
  'room:create': (name: string, callback: (room: RoomInfo | null) => void) => void;
  'room:join': (code: string, name: string, callback: (room: RoomInfo | null, error?: string) => void) => void;
  'room:leave': () => void;
  'room:ready': (ready: boolean) => void;
  'room:start': () => void;
  'player:loadout': (movement: MovementType, weapon: WeaponType) => void;
  'player:loadoutReady': (ready: boolean) => void;
  'player:input': (input: InputState) => void;
  'player:respawn': () => void;
  'player:reload': () => void;
}

// Network events - Server to Client
export interface ServerToClientEvents {
  'room:updated': (room: RoomInfo) => void;
  'room:closed': () => void;
  'loadout:phase': () => void;
  'game:starting': (countdown: number) => void;
  'game:started': () => void;
  'game:state': (state: GameState) => void;
  'game:hit': (data: { targetId: string; damage: number; sourceId: string }) => void;
  'game:kill': (data: { killerId: string; victimId: string }) => void;
  'game:ended': (data: { winnerId: string; scores: Record<string, { kills: number; deaths: number }> }) => void;
  'game:hitscan': (data: { sourceId: string; startX: number; startY: number; endX: number; endY: number }) => void;
}
