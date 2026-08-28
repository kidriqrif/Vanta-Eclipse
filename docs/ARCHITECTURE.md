# Vanta Eclipse — Architecture

This document explains how the React + Capacitor port is organized.

## The Context Pattern

The game needs objects created once at launch, alive for the whole session and reachable from anywhere. In the original Unity version, this was a static service locator. In the modern React rewrite, this is handled through **React Context** and modular hook state.

All long-lived game logic lives primarily within `src/context/GameContext.tsx`. Screens never own core game state directly; they read from the context and trigger centralized state updates.

### Core Systems

| System | Responsibility |
| --- | --- |
| `GameProvider` | Wraps the entire application, maintaining the global clock, tick loops, and persistence. |
| `Currency` | All currency balances (essence, void crystals, astral shards). |
| `Upgrades` | Upgrade definitions + owned levels; answers stat-modifier queries. |
| `Equipment` | Inventory, equipped items, drop logic. |
| `Relics` / `Pets` | Collection, active selections, XP/level/evolution. |
| `Combat` | Three-state combat machine (normal/boss/farm), gates, countdown, rewards. |
| `IdleManager` | Auto-attack ticking, offline-reward eligibility. |
| `Persistence` | Loads/saves game state to `localStorage` under `vanta_eclipse_save_v1`. |

## Art and Assets

Visual assets were originally generated from a Python pipeline. The finalized PNGs and fonts have now been moved to the `public/` directory so they can be statically served by Vite and automatically bundled by Capacitor.

*   Sprites, icons, and UI elements: `public/art/`
*   Audio effects: `public/audio/`
*   Fonts: `public/fonts/`

## Deployment

The game builds via standard web tooling:
```bash
npm run build
```

The output (`dist/`) is synchronized directly to the native Android project via Capacitor:
```bash
npx cap sync android
```
The result is a standard native Android project located in `android/` which can be compiled via Android Studio into a production `.aab` file.
