// ============================================
// Sky Battles - Game Server
// Express + Socket.IO server for multiplayer
// ============================================

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { GameRoom } from './GameRoom';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  MovementType,
  WeaponType,
  InputState
} from '../shared/types';
import { SERVER_PORT, ROOM_CODE_LENGTH, MAX_PLAYERS } from '../shared/constants';

const app = express();
const httpServer = createServer(app);

// ===================
// SECURITY CONSTANTS
// ===================
const MAX_ROOMS = 100;
const MAX_NAME_LENGTH = 12;
const ROOM_CREATE_COOLDOWN_MS = 5000;

// Rate limiting for room creation (per IP)
const roomCreateCooldowns = new Map<string, number>();

// CORS origins - defaults to localhost, set CORS_ORIGINS env var for production
const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:5173', 'http://127.0.0.1:5173'];

// Socket.IO server with CORS
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: corsOrigins,
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

  // Trim and limit length
  const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
  if (trimmed.length === 0) return null;

  // Remove potentially dangerous characters (keep alphanumeric, spaces, basic punctuation)
  const sanitized = trimmed.replace(/[^\w\s\-_.]/g, '');
  if (sanitized.length === 0) return null;

  return sanitized;
}

// Handle socket connections
io.on('connection', (socket: Socket<ClientToServerEvents, ServerToClientEvents>) => {
  console.log(`Player connected: ${socket.id}`);

  // Create a new room
  socket.on('room:create', (name, callback) => {
    // Validate and sanitize name
    const sanitizedName = sanitizeName(name);
    if (!sanitizedName) {
      callback(null);
      return;
    }

    // Rate limit room creation
    const clientIp = socket.handshake.address;
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
    const code = playerRooms.get(socket.id);
    if (!code) return;

    const room = rooms.get(code);
    if (!room) return;

    room.handleInput(socket.id, input);
  });

  // Handle respawn request
  socket.on('player:respawn', () => {
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

// Start server
httpServer.listen(SERVER_PORT, () => {
  console.log(`Sky Battles server running on port ${SERVER_PORT}`);
});
