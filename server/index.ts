// ============================================
// Sky Battles - Game Server
// Express + Socket.IO server for multiplayer
// ============================================

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { fileURLToPath } from 'url';
import path from 'path';
import { GameRoom } from './GameRoom';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  MovementType,
  WeaponType,
  InputState
} from '../shared/types';
import { ROOM_CODE_LENGTH, MAX_PLAYERS } from '../shared/constants';

// ES module __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Port configuration - use PORT env var for cloud platforms (Render, Railway)
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

const app = express();
const httpServer = createServer(app);

// ===================
// SECURITY CONSTANTS
// ===================
const MAX_ROOMS = 100;
const MAX_NAME_LENGTH = 12;
const ROOM_CREATE_COOLDOWN_MS = 5000;
const MAX_CONNECTIONS_PER_IP = 5;
const INPUT_RATE_LIMIT_MS = 16; // ~60 inputs/sec max (game runs at 60fps)
const RESPAWN_RATE_LIMIT_MS = 1000; // 1 respawn per second
const READY_TOGGLE_RATE_LIMIT_MS = 500; // Prevent ready spam
const ROOM_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle timeout
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000; // Check for idle rooms every minute

// Valid enum values for runtime validation
const VALID_MOVEMENT_TYPES = Object.values(MovementType);
const VALID_WEAPON_TYPES = Object.values(WeaponType);

// Rate limiting for room creation (per IP)
const roomCreateCooldowns = new Map<string, number>();

// Connection tracking per IP
const connectionsPerIp = new Map<string, number>();

// Per-socket rate limiting
const socketLastInput = new Map<string, number>();
const socketLastRespawn = new Map<string, number>();
const socketLastReady = new Map<string, number>();

// Room activity tracking for idle timeout
const roomLastActivity = new Map<string, number>();

function updateRoomActivity(code: string): void {
  roomLastActivity.set(code, Date.now());
}

function cleanupIdleRooms(): void {
  const now = Date.now();
  for (const [code, lastActivity] of roomLastActivity) {
    if (now - lastActivity > ROOM_IDLE_TIMEOUT_MS) {
      const room = rooms.get(code);
      if (room) {
        console.log(`Room ${code} timed out due to inactivity`);
        io.to(code).emit('room:closed');
        room.destroy();
        rooms.delete(code);
      }
      roomLastActivity.delete(code);
    }
  }
}

// Validation helpers
function isValidMovementType(value: unknown): value is MovementType {
  return typeof value === 'string' && VALID_MOVEMENT_TYPES.includes(value as MovementType);
}

function isValidWeaponType(value: unknown): value is WeaponType {
  return typeof value === 'string' && VALID_WEAPON_TYPES.includes(value as WeaponType);
}

function isValidInputState(input: unknown): input is InputState {
  if (typeof input !== 'object' || input === null) return false;
  const i = input as Record<string, unknown>;
  return (
    typeof i.up === 'boolean' &&
    typeof i.down === 'boolean' &&
    typeof i.left === 'boolean' &&
    typeof i.right === 'boolean' &&
    typeof i.jump === 'boolean' &&
    typeof i.crouch === 'boolean' &&
    typeof i.shooting === 'boolean' &&
    typeof i.mouseAngle === 'number' &&
    Number.isFinite(i.mouseAngle) &&
    // Validate angle is within reasonable bounds (-2π to 2π)
    i.mouseAngle >= -Math.PI * 2 &&
    i.mouseAngle <= Math.PI * 2
  );
}

// Get client IP, handling X-Forwarded-For from proxies (Render, Cloudflare, etc.)
function getClientIp(socket: Socket): string {
  // Check X-Forwarded-For header (set by reverse proxies)
  const forwardedFor = socket.handshake.headers['x-forwarded-for'];
  if (forwardedFor) {
    // X-Forwarded-For can be a comma-separated list; first IP is the client
    const ips = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const clientIp = ips.split(',')[0].trim();
    if (clientIp) return clientIp;
  }
  // Fall back to direct connection address
  return socket.handshake.address;
}

// CORS configuration
// In production: client and server are same origin, so CORS is less restrictive
// In development: allow localhost Vite dev server
// Can override with CORS_ORIGINS env var if needed
const getCorsOrigins = (): string[] | true => {
  if (process.env.CORS_ORIGINS) {
    return process.env.CORS_ORIGINS.split(',').map(s => s.trim());
  }
  if (process.env.NODE_ENV === 'production') {
    // In production, only allow the official domain
    return ['https://skybattles.onrender.com'];
  }
  // Development defaults
  return ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];
};

// Socket.IO server with CORS
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: getCorsOrigins(),
    methods: ['GET', 'POST']
  }
});

// Active game rooms
const rooms = new Map<string, GameRoom>();

// Player to room mapping
const playerRooms = new Map<string, string>();

// Generate unique room code
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';  // Removed ambiguous chars
  let code: string;
  do {
    code = Array.from({ length: ROOM_CODE_LENGTH }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
  } while (rooms.has(code));
  return code;
}

// Sanitize player name - returns null if invalid
function sanitizeName(name: unknown): string | null {
  if (typeof name !== 'string') return null;

  // First, strip all Unicode control characters, zero-width chars, and directional overrides
  // This prevents RTL attacks, invisible characters, and text spoofing
  const stripped = name
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')  // Control characters
    .replace(/[\u200B-\u200F\u2028-\u202F\uFEFF]/g, '')  // Zero-width and directional chars
    .replace(/[\u2060-\u206F]/g, '');  // Word joiner and invisible chars

  // Trim and limit length
  const trimmed = stripped.trim().slice(0, MAX_NAME_LENGTH);
  if (trimmed.length === 0) return null;

  // Only allow ASCII alphanumeric, spaces, and basic punctuation
  // This is more restrictive but prevents Unicode normalization attacks
  const sanitized = trimmed.replace(/[^a-zA-Z0-9\s\-_.]/g, '');
  if (sanitized.length === 0) return null;

  return sanitized;
}

// Handle socket connections
io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  const clientIp = getClientIp(socket);

  // Connection limit per IP
  const currentConnections = connectionsPerIp.get(clientIp) || 0;
  if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
    console.log(`Connection rejected: IP ${clientIp} exceeded limit (${MAX_CONNECTIONS_PER_IP})`);
    socket.disconnect(true);
    return;
  }
  connectionsPerIp.set(clientIp, currentConnections + 1);

  console.log(`Player connected: ${socket.id} (IP: ${clientIp}, connections: ${currentConnections + 1})`);

  // Create a new room
  socket.on('room:create', (name, callback) => {
    // Validate and sanitize name
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      callback(null);
      return;
    }

    // Rate limit room creation (uses clientIp from outer scope)
    const lastCreate = roomCreateCooldowns.get(clientIp) || 0;
    if (Date.now() - lastCreate < ROOM_CREATE_COOLDOWN_MS) {
      callback(null);
      return;
    }

    // Limit total rooms
    if (rooms.size >= MAX_ROOMS) {
      callback(null);
      return;
    }

    // Leave any existing room
    leaveCurrentRoom(socket);

    const code = generateRoomCode();
    const room = new GameRoom(code, socket.id, io);
    rooms.set(code, room);
    roomCreateCooldowns.set(clientIp, Date.now());
    updateRoomActivity(code);

    room.addPlayer(socket.id, sanitizedName);
    playerRooms.set(socket.id, code);
    socket.join(code);

    console.log(`Room ${code} created by ${sanitizedName} (${socket.id})`);
    callback(room.getInfo());
  });

  // Join an existing room
  socket.on('room:join', (code, name, callback) => {
    // Validate and sanitize name
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      callback(null, 'Invalid name');
      return;
    }

    // Validate room code format
    if (typeof code !== 'string' || code.length !== ROOM_CODE_LENGTH) {
      callback(null, 'Invalid room code');
      return;
    }

    const room = rooms.get(code.toUpperCase());

    if (!room) {
      callback(null, 'Room not found');
      return;
    }

    if (room.gameStarted || room.inLoadoutPhase) {
      callback(null, 'Game already in progress');
      return;
    }

    if (room.playerCount >= MAX_PLAYERS) {
      callback(null, 'Room is full');
      return;
    }

    // Leave any existing room
    leaveCurrentRoom(socket);

    room.addPlayer(socket.id, sanitizedName);
    playerRooms.set(socket.id, code.toUpperCase());
    socket.join(code.toUpperCase());
    updateRoomActivity(code.toUpperCase());

    console.log(`${sanitizedName} (${socket.id}) joined room ${code}`);
    callback(room.getInfo());

    // Notify other players
    socket.to(code.toUpperCase()).emit('room:updated', room.getInfo());
  });

  // Leave current room
  socket.on('room:leave', () => {
    leaveCurrentRoom(socket);
  });

  // Toggle ready state
  socket.on('room:ready', (ready) => {
    // Rate limit ready toggles
    const now = Date.now();
    const lastReady = socketLastReady.get(socket.id) || 0;
    if (now - lastReady < READY_TOGGLE_RATE_LIMIT_MS) {
      return;
    }
    socketLastReady.set(socket.id, now);

    // Validate input
    if (typeof ready !== 'boolean') return;

    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.setPlayerReady(socket.id, ready);
    io.to(code).emit('room:updated', room.getInfo());
  });

  // Start the game (host only)
  socket.on('room:start', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    if (room.hostId !== socket.id) {
      console.log(`Non-host ${socket.id} tried to start game`);
      return;
    }

    if (room.playerCount < 2) {
      console.log('Not enough players to start');
      return;
    }

    room.startGame();
  });

  // Set player loadout
  socket.on('player:loadout', (movement: MovementType, weapon: WeaponType) => {
    // Validate enum values at runtime
    if (!isValidMovementType(movement) || !isValidWeaponType(weapon)) {
      console.log(`Invalid loadout from ${socket.id}: movement=${movement}, weapon=${weapon}`);
      return;
    }

    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.setPlayerLoadout(socket.id, movement, weapon);
    io.to(code).emit('room:updated', room.getInfo());
  });

  // Set player loadout ready
  socket.on('player:loadoutReady', (ready: boolean) => {
    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.setPlayerLoadoutReady(socket.id, ready);
    io.to(code).emit('room:updated', room.getInfo());
  });

  // Handle player input
  socket.on('player:input', (input: InputState) => {
    // Rate limit inputs
    const now = Date.now();
    const lastInput = socketLastInput.get(socket.id) || 0;
    if (now - lastInput < INPUT_RATE_LIMIT_MS) {
      return; // Silently drop excessive inputs
    }
    socketLastInput.set(socket.id, now);

    // Validate input structure
    if (!isValidInputState(input)) {
      return;
    }

    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    updateRoomActivity(code);
    room.handleInput(socket.id, input);
  });

  // Handle respawn request
  socket.on('player:respawn', () => {
    // Rate limit respawns
    const now = Date.now();
    const lastRespawn = socketLastRespawn.get(socket.id) || 0;
    if (now - lastRespawn < RESPAWN_RATE_LIMIT_MS) {
      return;
    }
    socketLastRespawn.set(socket.id, now);

    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.respawnPlayer(socket.id);
  });

  // Handle reload request
  socket.on('player:reload', () => {
    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.manualReload(socket.id);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`Player disconnected: ${socket.id}`);
    leaveCurrentRoom(socket);

    // Decrement connection count for this IP
    const currentCount = connectionsPerIp.get(clientIp) || 1;
    if (currentCount <= 1) {
      connectionsPerIp.delete(clientIp);
    } else {
      connectionsPerIp.set(clientIp, currentCount - 1);
    }

    // Clean up rate limiting maps
    socketLastInput.delete(socket.id);
    socketLastRespawn.delete(socket.id);
    socketLastReady.delete(socket.id);
  });
});

// Helper to leave current room
function leaveCurrentRoom(socket: Socket) {
  const code = playerRooms.get(socket.id);
  if (!code) return;

  const room = rooms.get(code);
  if (room) {
    room.removePlayer(socket.id);
    socket.leave(code);

    if (room.playerCount === 0) {
      io.to(code).emit('room:closed');
      room.destroy();
      rooms.delete(code);
      roomLastActivity.delete(code);
      console.log(`Room ${code} destroyed (empty)`);
    } else {
      // If host left, assign new host
      if (room.hostId === socket.id) {
        const newHost = room.getFirstPlayerId();
        if (newHost) {
          room.hostId = newHost;
        }
      }
      io.to(code).emit('room:updated', room.getInfo());
    }
  }

  playerRooms.delete(socket.id);
}

// ===================
// API ROUTES
// ===================

// Health check endpoint for load balancers
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', rooms: rooms.size });
});

// ===================
// PRODUCTION STATIC FILES
// ===================
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction) {
  // Serve built client files from dist/client
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));

  // SPA wildcard - serve index.html for all non-API routes (must be last)
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// Start idle room cleanup interval
setInterval(cleanupIdleRooms, ROOM_CLEANUP_INTERVAL_MS);

// Start server
httpServer.listen(PORT, () => {
  console.log(`Sky Battles server running on port ${PORT}`);
  if (isProduction) {
    console.log('Serving static files from dist/client');
  }
});
