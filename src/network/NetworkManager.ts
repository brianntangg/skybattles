// ============================================
// Sky Battles - Network Manager
// Handles all Socket.IO communication
// ============================================

import { io, Socket } from 'socket.io-client';
import {
  ClientToServerEvents,
  ServerToClientEvents,
  RoomInfo,
  GameState,
  InputState,
  MovementType,
  WeaponType
} from '../../shared/types';

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

class NetworkManager {
  private socket: TypedSocket | null = null;
  private connected = false;

  // Event callbacks
  onRoomUpdated: ((room: RoomInfo) => void) | null = null;
  onRoomClosed: (() => void) | null = null;
  onLoadoutPhase: (() => void) | null = null;
  onGameStarting: ((countdown: number) => void) | null = null;
  onGameStarted: (() => void) | null = null;
  onGameState: ((state: GameState) => void) | null = null;
  onGameHit: ((data: { targetId: string; damage: number; sourceId: string }) => void) | null = null;
  onGameKill: ((data: { killerId: string; victimId: string }) => void) | null = null;
  onGameEnded: ((data: { winnerId: string; scores: Record<string, { kills: number; deaths: number }> }) => void) | null = null;
  onGameHitscan: ((data: { sourceId: string; startX: number; startY: number; endX: number; endY: number }) => void) | null = null;

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve();
        return;
      }

      this.socket = io({
        transports: ['websocket', 'polling']
      });

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 5000);

      this.socket.on('connect', () => {
        clearTimeout(timeout);
        console.log('Connected to server:', this.socket?.id);
        this.connected = true;
        resolve();
      });

      this.socket.on('disconnect', () => {
        console.log('Disconnected from server');
        this.connected = false;
      });

      this.socket.on('connect_error', (err) => {
        clearTimeout(timeout);
        console.error('Connection error:', err);
        reject(err);
      });

      this.setupEventHandlers();
    });
  }

  private setupEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('room:updated', (room) => {
      this.onRoomUpdated?.(room);
    });

    this.socket.on('room:closed', () => {
      this.onRoomClosed?.();
    });

    this.socket.on('loadout:phase', () => {
      this.onLoadoutPhase?.();
    });

    this.socket.on('game:starting', (countdown) => {
      this.onGameStarting?.(countdown);
    });

    this.socket.on('game:started', () => {
      this.onGameStarted?.();
    });

    this.socket.on('game:state', (state) => {
      this.onGameState?.(state);
    });

    this.socket.on('game:hit', (data) => {
      this.onGameHit?.(data);
    });

    this.socket.on('game:kill', (data) => {
      this.onGameKill?.(data);
    });

    this.socket.on('game:ended', (data) => {
      this.onGameEnded?.(data);
    });

    this.socket.on('game:hitscan', (data) => {
      this.onGameHitscan?.(data);
    });
  }

  get playerId(): string | undefined {
    return this.socket?.id;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  createRoom(name: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('room:create', name, (room) => {
        if (room) {
          resolve(room);
        } else {
          reject(new Error('Failed to create room'));
        }
      });
    });
  }

  joinRoom(code: string, name: string): Promise<RoomInfo> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Not connected'));
        return;
      }

      this.socket.emit('room:join', code, name, (room, error) => {
        if (room) {
          resolve(room);
        } else {
          reject(new Error(error || 'Failed to join room'));
        }
      });
    });
  }

  leaveRoom(): void {
    this.socket?.emit('room:leave');
  }

  setReady(ready: boolean): void {
    this.socket?.emit('room:ready', ready);
  }

  startGame(): void {
    this.socket?.emit('room:start');
  }

  setLoadout(movement: MovementType, weapon: WeaponType): void {
    this.socket?.emit('player:loadout', movement, weapon);
  }

  setLoadoutReady(ready: boolean): void {
    this.socket?.emit('player:loadoutReady', ready);
  }

  sendInput(input: InputState): void {
    this.socket?.emit('player:input', input);
  }

  requestRespawn(): void {
    this.socket?.emit('player:respawn');
  }

  requestReload(): void {
    this.socket?.emit('player:reload');
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.connected = false;
  }
}

// Singleton instance
export const networkManager = new NetworkManager();
