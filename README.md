# Sky Battles

A fast-paced 2D top-down multiplayer PvP arena game built around vertical mobility, aerial combat, and tactical arenas.

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

### Networking

- **Server-Authoritative**: Server validates all actions
- **20Hz Tick Rate**: State broadcast every 50ms
- **Client Prediction**: Local movement is predicted
- **Interpolation**: Remote players smoothly interpolated

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
