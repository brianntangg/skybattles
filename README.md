# Sky Battles

A fast-paced 2D top-down multiplayer PvP arena game built around vertical mobility, aerial combat, and tactical arenas.

## Features

- **4-Player Multiplayer**: Online matches with room codes
- **4 Movement Types**: Wings, Fire Jetpack, Water Jetpack, Levitation
- **4 Weapons**: Machine Gun, Pulse Laser, Sniper, Rocket
- **5 Arena Maps**: Each favoring different playstyles
- **Vertical Combat**: Z-axis movement with altitude affecting collisions

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
6. Select your movement type and weapon
7. Battle!

## Controls

| Key        | Action            |
| ---------- | ----------------- |
| W/A/S/D    | Move horizontally |
| Space      | Ascend            |
| Shift      | Descend           |
| Mouse      | Aim               |
| Left Click | Shoot             |

## Game Balance

### Movement Types

| Type              | Strengths                            | Weaknesses                             |
| ----------------- | ------------------------------------ | -------------------------------------- |
| **Wings**         | Fastest horizontal speed, no fuel    | Slow vertical climb, predictable glide |
| **Fire Jetpack**  | Explosive vertical burst             | Burns fuel quickly, loud/visible       |
| **Water Jetpack** | Balanced, can hover, fast fuel regen | Jack of all trades                     |
| **Levitation**    | Perfect control, no fuel             | Slowest movement                       |

### Weapons

| Weapon          | Damage | Fire Rate | Special                          |
| --------------- | ------ | --------- | -------------------------------- |
| **Machine Gun** | 8      | 10/sec    | High DPS at close range          |
| **Pulse Laser** | 25     | 2/sec     | Pierces through enemies          |
| **Sniper**      | 100    | 0.5/sec   | One-shot kill, hitscan           |
| **Rocket**      | 50     | 1/sec     | Slow but powerful splash damage  |

### Arena Layout

```text
         [TOP - The Towers]
              Vertical focus
                   |
[LEFT - Cliffs]--[CENTER - Colosseum]--[RIGHT - The Maze]
  High ground        Open arena           Cover-heavy
                   |
        [BOTTOM - The Tunnels]
           Low ceiling corridors
```

Each arena naturally favors different movement/weapon combinations:

- **The Towers**: Fire Jetpack, Levitation thrive (vertical play)
- **The Tunnels**: Wings, Water Jetpack excel (horizontal corridors)
- **The Cliffs**: Sniper heaven with high ground advantage
- **The Maze**: Machine Gun dominates (close quarters)
- **The Colosseum**: All builds viable, pure skill determines winner

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

## Deployment

### Environment Variables

| Variable       | Description                      | Default                  |
|----------------|----------------------------------|--------------------------|
| `PORT`         | Server port                      | `3000`                   |
| `CORS_ORIGINS` | Comma-separated allowed origins  | `http://localhost:5173`  |

### Hosting Example

```bash
# Build the client
npm run build

# Set environment variables for production
export CORS_ORIGINS="https://yourdomain.com,https://www.yourdomain.com"

# Run the server (serves from dist/)
npm run server
```

For platforms like Railway, Render, or Fly.io:

1. Set `CORS_ORIGINS` to your frontend URL
2. The server runs on port 3000 by default
3. Serve the `dist/` folder for the client (or use a CDN)

## License

MIT
