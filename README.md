# Sky Battles

A fast-paced 2D top-down multiplayer PvP arena game built around vertical mobility, aerial combat, and tactical arenas.

## Live Demo

Play now at: <https://skybattles.onrender.com>

## Features

- **4-Player Multiplayer**: Online matches with room codes, host controls, and rematch support
- **Deathmatch Mode**: First to 11 kills wins
- **4 Weapons**: Machine Gun, Pulse Laser, Sniper, Rocket Launcher
- **Vertical Combat**: Z-axis movement (0-100 altitude) with altitude-based hit detection
- **Dynamic Arena**: Breakable obstacles, elevated platforms, and strategic cover
- **HUD Features**: Minimap, kill feed, ammo counter, and leaderboard

## Quick Start

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Running the Game

Start both the server and client:

```bash
npm start
```

Or run them separately:

```bash
# Terminal 1 - Start the game server
npm run server

# Terminal 2 - Start the client dev server
npm run dev
```

### Playing

1. Open <http://localhost:5173> in your browser
2. Enter your name and click "CREATE ROOM"
3. Share the 4-letter room code with friends
4. Other players open the same URL and enter the room code
5. Host clicks "START GAME" when ready (2+ players required)
6. Select your weapon
7. Battle!

## Controls

| Key        | Action            |
| ---------- | ----------------- |
| W/A/S/D    | Move horizontally |
| Space      | Ascend            |
| Shift      | Descend           |
| Mouse      | Aim               |
| Left Click | Shoot             |
| R          | Reload            |

## Game Balance

### Weapons

| Weapon          | Damage | Fire Rate | Clip | Reload | Special                 |
| --------------- | ------ | --------- | ---- | ------ | ----------------------- |
| **Machine Gun** | 8      | 10/sec    | 30   | 2.0s   | High DPS, slight spread |
| **Pulse Laser** | 25     | 2/sec     | 8    | 1.5s   | Perfect accuracy        |
| **Sniper**      | 100    | 0.5/sec   | 1    | 2.0s   | One-shot kill, hitscan  |
| **Rocket**      | 50     | 1/sec     | 4    | 2.5s   | Projectile travel time  |

### Arena: Battle Arena

A 1024x768 combat zone featuring:

- **Central Platform**: Elevated area (40-60 Z height) for high-ground advantage
- **Corner Pillars**: 4 breakable obstacles (50 HP each) for destructible cover
- **Mid-lane Barriers**: 2 breakable barriers for tactical positioning
- **Central Obstacle**: Solid cover in the arena center
- **4 Spawn Points**: One in each corner with 3-second spawn protection

## Architecture

```text
skybattles/
├── server/              # Game server (Socket.IO)
│   ├── index.ts         # Server entry, connection handling
│   └── GameRoom.ts      # Game logic, physics, state sync
├── src/                 # Client (Phaser 3)
│   ├── main.ts          # Phaser entry
│   ├── scenes/          # Game scenes
│   │   ├── BootScene.ts
│   │   ├── MenuScene.ts
│   │   ├── LobbyScene.ts
│   │   ├── LoadoutScene.ts
│   │   └── GameScene.ts
│   └── network/         # Socket.IO client
│       └── NetworkManager.ts
└── shared/              # Shared between client/server
    ├── types.ts         # TypeScript interfaces
    └── constants.ts     # Game balance values
```

---

## How It Works

This section explains the complete flow of the application from connection to gameplay.

### System Architecture Overview

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SKY BATTLES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────┐                    ┌─────────────────────┐       │
│   │   BROWSER CLIENT    │                    │      SERVER         │       │
│   │   (Phaser 3 + TS)   │                    │   (Node.js + TS)    │       │
│   │                     │                    │                     │       │
│   │  ┌───────────────┐  │    WebSocket       │  ┌───────────────┐  │       │
│   │  │ NetworkManager│◄─┼────────────────────┼─►│  Socket.IO    │  │       │
│   │  └───────────────┘  │   (Socket.IO)      │  └───────────────┘  │       │
│   │         │           │                    │         │           │       │
│   │         ▼           │                    │         ▼           │       │
│   │  ┌───────────────┐  │                    │  ┌───────────────┐  │       │
│   │  │    Scenes     │  │                    │  │   GameRoom    │  │       │
│   │  │  (Game UI)    │  │                    │  │ (Game Logic)  │  │       │
│   │  └───────────────┘  │                    │  └───────────────┘  │       │
│   │         │           │                    │         │           │       │
│   │         ▼           │                    │         ▼           │       │
│   │  ┌───────────────┐  │                    │  ┌───────────────┐  │       │
│   │  │   Renderer    │  │                    │  │    Physics    │  │       │
│   │  │  (Canvas 2D)  │  │                    │  │  (20Hz Loop)  │  │       │
│   │  └───────────────┘  │                    │  └───────────────┘  │       │
│   │                     │                    │                     │       │
│   └─────────────────────┘                    └─────────────────────┘       │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────┐      │
│   │                      SHARED CODE (TypeScript)                    │      │
│   │   • types.ts - Game interfaces (PlayerState, ProjectileState)   │      │
│   │   • constants.ts - Weapon stats, movement values, arena defs    │      │
│   └─────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Client Scene Flow

The game uses Phaser's scene system as a state machine:

```text
┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  BootScene   │────►│  MenuScene   │────►│  LobbyScene  │────►│ LoadoutScene │────►│  GameScene   │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │                    │                    │
       ▼                    ▼                    ▼                    ▼                    ▼
  • Connect to         • Enter name         • Display room       • Select weapon      • Render game
    server             • Create room          code               • Click READY        • Handle input
  • Show loading       • Join with code     • Show players       • Wait for all       • Show HUD
  • Retry on fail      • Validate input     • Ready toggle         players            • Process state
                                            • Host starts                              • Combat!
```

### Network Communication Flow

The game uses a **server-authoritative** model where the server is the single source of truth:

```text
         CLIENT                                           SERVER
           │                                                │
           │  1. Connect (WebSocket handshake)              │
           │───────────────────────────────────────────────►│
           │                                                │
           │  2. room:create / room:join                    │
           │───────────────────────────────────────────────►│
           │                          room:updated ◄────────│ Broadcast to room
           │◄───────────────────────────────────────────────│
           │                                                │
           │  3. room:start (host only)                     │
           │───────────────────────────────────────────────►│
           │                         loadout:phase ◄────────│ All players
           │◄───────────────────────────────────────────────│
           │                                                │
           │  4. player:loadout (weapon choice)             │
           │───────────────────────────────────────────────►│
           │  5. player:loadoutReady                        │
           │───────────────────────────────────────────────►│
           │                                                │
           │                    game:starting(3,2,1) ◄──────│ Countdown
           │◄───────────────────────────────────────────────│
           │                        game:started ◄──────────│ Game begins!
           │◄───────────────────────────────────────────────│
           │                                                │
     ┌─────┴─────────────── GAME LOOP (20Hz) ───────────────┴─────┐
     │     │                                                │     │
     │     │  player:input (WASD, mouse, shooting)          │     │
     │     │───────────────────────────────────────────────►│     │
     │     │                   ┌─────────────────────┐      │     │
     │     │                   │ Server processes:   │      │     │
     │     │                   │ • Apply movement    │      │     │
     │     │                   │ • Update projectiles│      │     │
     │     │                   │ • Check collisions  │      │     │
     │     │                   │ • Calculate damage  │      │     │
     │     │                   └─────────────────────┘      │     │
     │     │                                                │     │
     │     │                      game:state ◄──────────────│     │ Broadcast
     │     │◄───────────────────────────────────────────────│     │ every 50ms
     │     │                                                │     │
     │     │                      game:hit ◄────────────────│     │ On damage
     │     │◄───────────────────────────────────────────────│     │
     │     │                      game:kill ◄───────────────│     │ On kill
     │     │◄───────────────────────────────────────────────│     │
     └─────┴────────────────────────────────────────────────┴─────┘
           │                                                │
           │                      game:ended ◄──────────────│ Winner!
           │◄───────────────────────────────────────────────│
           │                                                │
```

### Server Game Loop (20Hz)

Every 50 milliseconds, the server executes this loop:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SERVER GAME LOOP (every 50ms)                        │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │    1. UPDATE PLAYERS            │
                    │    ─────────────────────────    │
                    │    For each player:             │
                    │    • Read stored input          │
                    │    • Apply acceleration         │
                    │    • Handle Z-axis (altitude)   │
                    │    • Apply gravity/fuel         │
                    │    • Check wall collisions      │
                    │    • Process shooting           │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │    2. UPDATE PROJECTILES        │
                    │    ─────────────────────────    │
                    │    For each projectile:         │
                    │    • Move by velocity           │
                    │    • Check lifetime (max 5s)    │
                    │    • Wall collision → destroy   │
                    │    • Obstacle hit → damage it   │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │    3. CHECK COLLISIONS          │
                    │    ─────────────────────────    │
                    │    For each projectile:         │
                    │    • Check against all players  │
                    │    • Circle collision detection │
                    │    • Z-tolerance check (±15)    │
                    │    • Apply damage if hit        │
                    │    • Track kills/deaths         │
                    │    • Check win condition (11)   │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                    ┌─────────────────────────────────┐
                    │    4. BROADCAST STATE           │
                    │    ─────────────────────────    │
                    │    Send to all players:         │
                    │    • All player positions/HP    │
                    │    • All projectile positions   │
                    │    • All obstacle states        │
                    │    • Tick number & timestamp    │
                    └─────────────────────────────────┘
                                      │
                                      ▼
                              (repeat every 50ms)
```

### Client Rendering Flow

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CLIENT RENDER LOOP (60fps)                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
          ┌───────────────────────────┴───────────────────────────┐
          │                                                       │
          ▼                                                       ▼
┌─────────────────────┐                             ┌─────────────────────┐
│   RECEIVE STATE     │                             │   CAPTURE INPUT     │
│   from server       │                             │   from player       │
│   (game:state)      │                             │   (keyboard/mouse)  │
└─────────────────────┘                             └─────────────────────┘
          │                                                       │
          ▼                                                       ▼
┌─────────────────────┐                             ┌─────────────────────┐
│   INTERPOLATE       │                             │   SEND INPUT        │
│   positions between │                             │   to server (20Hz)  │
│   previous & current│                             │   (player:input)    │
└─────────────────────┘                             └─────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RENDER FRAME                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Arena     │  │   Players   │  │ Projectiles │  │        HUD          │ │
│  │  ─────────  │  │  ─────────  │  │  ─────────  │  │  ─────────────────  │ │
│  │ • Walls     │  │ • Sprites   │  │ • Bullets   │  │ • Minimap           │ │
│  │ • Platforms │  │ • Shadows   │  │ • Rockets   │  │ • Kill feed         │ │
│  │ • Obstacles │  │ • HP bars   │  │ • Lasers    │  │ • Ammo counter      │ │
│  │             │  │ • Names     │  │ • Trails    │  │ • Leaderboard       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Weapon Systems

The game implements two types of weapons:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WEAPON TYPES                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   PROJECTILE WEAPONS (Machine Gun, Pulse Laser, Rocket)                     │
│   ─────────────────────────────────────────────────────                     │
│                                                                             │
│      Player ──► Spawn Projectile ──► Travel at speed ──► Hit Detection     │
│         │              │                    │                   │           │
│         │              ▼                    ▼                   ▼           │
│         │        Position at           Update each         On collision:    │
│         │        gun barrel            tick (50ms)         • Wall: destroy  │
│         │                                                  • Player: damage │
│         │                                                  • Obstacle: dmg  │
│                                                                             │
│   HITSCAN WEAPON (Sniper)                                                   │
│   ───────────────────────                                                   │
│                                                                             │
│      Player ──► Instant Raycast ──► Check intersections ──► Apply damage   │
│         │              │                    │                   │           │
│         │              ▼                    ▼                   ▼           │
│         │        Ray from gun         1. Walls (block)     Damage first    │
│         │        to max range         2. Obstacles (dmg)   player hit      │
│         │                             3. Players (hit)                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Z-Axis (Altitude) System

```text
                          Z = 100 (ceiling)
                               │
    ┌──────────────────────────┼──────────────────────────┐
    │                          │                          │
    │   ✈ Player at Z=80       │      Projectile at Z=75  │   ← Can hit! (within ±15)
    │                          │                          │
    │──────────────────────────┼──────────────────────────│   Z = 60 (platform top)
    │                          │                          │
    │   █████████████████████████████████████████████████ │   ← Elevated Platform
    │                          │                          │
    │──────────────────────────┼──────────────────────────│   Z = 40 (platform base)
    │                          │                          │
    │                          │      Projectile at Z=20  │   ← Miss! (too low)
    │   ✈ Player at Z=30       │                          │
    │                          │                          │
    └──────────────────────────┼──────────────────────────┘
                               │
                          Z = 0 (ground)

    Hit Detection: |target.z - projectile.z| <= 15
```

### Data Flow Summary

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMPLETE DATA FLOW                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   INPUT (Client → Server)                                                   │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  {                                                                   │  │
│   │    up: boolean,        // W key                                      │  │
│   │    down: boolean,      // S key                                      │  │
│   │    left: boolean,      // A key                                      │  │
│   │    right: boolean,     // D key                                      │  │
│   │    jump: boolean,      // Space (ascend)                             │  │
│   │    crouch: boolean,    // Shift (descend)                            │  │
│   │    shooting: boolean,  // Mouse button                               │  │
│   │    mouseAngle: number  // Aim direction (radians)                    │  │
│   │  }                                                                   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                      │                                      │
│                                      ▼                                      │
│                            SERVER PROCESSES                                 │
│                                      │                                      │
│                                      ▼                                      │
│   GAME STATE (Server → Client)                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  {                                                                   │  │
│   │    players: [{                                                       │  │
│   │      id, name, x, y, z, angle, health, kills, deaths,               │  │
│   │      velocityX, velocityY, ammo, isReloading, hasSpawnProtection    │  │
│   │    }, ...],                                                          │  │
│   │    projectiles: [{ id, x, y, z, angle, speed, damage, ownerId }],   │  │
│   │    obstacles: [{ id, x, y, health, maxHealth }],                     │  │
│   │    tick: number,                                                     │  │
│   │    timestamp: number                                                 │  │
│   │  }                                                                   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Model

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SECURITY MEASURES                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐        │
│   │  CONNECTION     │    │  INPUT          │    │  GAME           │        │
│   │  LIMITS         │    │  VALIDATION     │    │  LIMITS         │        │
│   │  ─────────────  │    │  ─────────────  │    │  ─────────────  │        │
│   │  • 5 per IP     │    │  • Rate limit   │    │  • 50 bullets   │        │
│   │  • CORS check   │    │  • Type check   │    │    per player   │        │
│   │  • 100 max rooms│    │  • Range check  │    │  • 30min idle   │        │
│   │                 │    │  • Sanitize     │    │    timeout      │        │
│   └─────────────────┘    └─────────────────┘    └─────────────────┘        │
│                                                                             │
│   WHY SERVER-AUTHORITATIVE?                                                 │
│   ─────────────────────────                                                 │
│   • Client only sends INPUT, never game state                               │
│   • Server calculates ALL physics and damage                                │
│   • Prevents speed hacks, damage hacks, teleporting                         │
│   • Client can't claim hits - server validates everything                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Networking

- **Server-Authoritative**: Server validates all actions
- **20Hz Tick Rate**: State broadcast every 50ms
- **Client Interpolation**: Remote players smoothly interpolated between states
- **WebSocket Protocol**: Socket.IO for reliable real-time communication

## Tech Stack

- **Engine**: Phaser 3
- **Server**: Express + Socket.IO
- **Build**: Vite + TypeScript
- **Runtime**: Node.js

## Development

```bash
# Install dependencies
npm install

# Run in development mode (hot reload)
npm start

# Build for production
npm run build
```

## License

MIT
