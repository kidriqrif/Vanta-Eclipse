# Vanta Eclipse

An idle RPG for Android (Google Play), with Web and iOS support built-in.
Portrait, offline, no paywall.

This project was originally built in Unity but has been fully rewritten into a modern web stack using **React, Vite, and Capacitor** for native Android distribution.

[Project page](https://kidriqrif.github.io/Vanta-Eclipse/) &middot;
[Architecture](docs/ARCHITECTURE.md)

## Tech Stack

*   **Frontend**: React 18, TypeScript, Vite
*   **Styling**: Tailwind CSS
*   **Native Wrap**: Capacitor (`@capacitor/core`, `@capacitor/android`)
*   **Ad Integration**: `@capacitor-community/admob`

## Getting started

1.  Clone this repository.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the development server:
    ```bash
    npm run dev
    ```

## Building for Android (Google Play)

1. Build the production web assets:
    ```bash
    npm run build
    ```
2. Sync the web build to the Android project:
    ```bash
    npx cap sync android
    ```
3. Open Android Studio:
    ```bash
    npx cap open android
    ```
4. In Android Studio, go to **Build > Generate Signed Bundle / APK** to create your `.aab` for the Google Play Console Closed Testing track.

## Project structure

| Folder | Contents |
| --- | --- |
| `src/` | Core React application source code |
| `src/components/` | React UI components and screens |
| `src/context/` | Global state management (GameContext, EventBus) |
| `src/data/` | Static game content definitions (Enemies, Upgrades, Relics, etc.) |
| `src/utils/` | Helpers (Audio system, Save management) |
| `android/` | The native Capacitor Android project (opened with Android Studio) |
| `public/` | Static visual assets (sprites, icons, fonts) |
| `docs/`, `design/` | Architecture documentation and the UX/GDD specs |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the systems fit together.

## Where is my save file?

Progress is currently written to the browser's `localStorage` or Capacitor's native storage layer under the key `vanta_eclipse_save_v1`.

