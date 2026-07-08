<h1 align="center">⚓ TradeShips.io</h1>

<p align="center"><em>Real-time naval strategy: trade routes, ports, and sea power.</em></p>

**TradeShips.io** is an online real-time strategy game focused on **naval commerce and sea control**. Players expand their territory, build ports and cities, run trade routes with merchant ships, and fight for the seas with warships — across maps based on real-world geography.

This project is a fork of [OpenFront.io](https://github.com/openfrontio/OpenFrontIO) (itself a fork/rewrite of [WarFront.io](https://github.com/WarFrontIO)). Credit and thanks to both projects and their contributors.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Assets: CC BY-SA 4.0](https://img.shields.io/badge/Assets-CC%20BY--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-sa/4.0/)

## 🧭 What makes TradeShips different

TradeShips.io reshapes the original land-conquest formula into a **naval-economic experience**:

- **No strategic arsenal** — nukes, MIRVs, missile silos, SAMs, and defense posts are permanently disabled in every game mode. Conflict happens at sea, not from orbit.
- **Trade first** — ports, trade ships, and gold flow are the heart of the game.
- **Sea power decides** — warships, transports, and naval positioning are how you project force.

### Roadmap

| Status | Feature |
| ------ | ------- |
| ✅ | Arsenal lock — land/strategic weapons removed from all modes |
| ✅ | New naval combat layer: submarines, torpedoes, naval mines, and aircraft carriers |
| ✅ | Visible merchant traffic — trade ships leave active sea-route trails |
| ✅ | Commerce telemetry — own route count, estimated route value, contested/danger lanes, and escort coverage in the HUD |
| ✅ | Aircraft carrier phase 2a — mobile repair hub for nearby warships |
| 🔜 | Deeper commerce: exact path-based route value, convoy orders, and port income UI |
| 🔜 | Aircraft carrier phase 2b — mobile trade support hub |
| 🔜 | Full rebranding with original sprites and visual identity |

## 🌟 Features

- **Real-time Strategy Gameplay**: expand your territory and fight for control of the seas
- **Trade & Economy**: build ports, run trade routes, and out-earn your rivals
- **Alliance System**: form alliances with other players for mutual defense
- **Multiple Maps**: play across various geographical regions including Europe, Asia, Africa, and more
- **Cross-platform**: play in any modern web browser

## 📋 Prerequisites

- [npm](https://www.npmjs.com/) (v10.9.2 or higher)
- A modern web browser (Chrome, Firefox, Edge, etc.)

## 🚀 Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/ByGamer01/TradeShips.io.git
   cd TradeShips.io
   ```

2. **Install dependencies**

   ```bash
   npm run inst
   ```

   Do NOT use `npm install` nor `npm i` but instead use our `npm run inst`. It runs the safer `npm ci --ignore-scripts` to install dependencies exactly according to the versions in `package-lock.json` and doesn't run scripts. This can prevent being hit by a supply chain attack.

## 🎮 Running the Game

### Development Mode

Run both the client and server in development mode with live reloading:

```bash
npm run dev
```

This will:

- Start the dev server for the client
- Launch the game server with development settings
- Open the game in your default browser (to disable this behavior, set `SKIP_BROWSER_OPEN=true` in your environment)

### Client Only

```bash
npm run start:client
```

### Server Only

```bash
npm run start:server-dev
```

## 🛠️ Development Tools

- **Format code**:

  ```bash
  npm run format
  ```

- **Lint code**:

  ```bash
  npm run lint
  ```

- **Lint and fix code**:

  ```bash
  npm run lint:fix
  ```

- **Testing**
  ```bash
  npm test
  ```

## 🏗️ Project Structure

- `/src/client` - Frontend game client
- `/src/core` - Deterministic game simulation
- `/src/server` - Backend game server
- `/resources` - Static assets (images, maps, etc.)

## 📜 License

TradeShips.io source code is licensed under the **GNU Affero General Public License v3.0**, inherited from OpenFront.

As a modified version of OpenFront, this project preserves the upstream copyright notices ("© OpenFront and Contributors") in the footer and loading screen, as required by the license.

See the [LICENSE](LICENSE) for complete requirements.

For asset licensing, see [LICENSE-ASSETS](LICENSE-ASSETS).
For license history, see [LICENSING.md](LICENSING.md).

> **Note on assets**: files under `/proprietary` come from upstream OpenFront and are **not** freely licensed. They are being replaced with original TradeShips.io assets as part of the rebranding effort.

## 🤝 Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow.
