# Handoff — Vanta Eclipse

**Snapshot: React/Capacitor Port (August 2026)**

This document was originally written for a Unity project. The game has since been ported entirely to a modern web stack (React and Capacitor) to target the Web and Android (via Google Play Console).

## What this is

A portrait, offline, idle RPG for Android and Web. Built with **React 18, TypeScript, Tailwind CSS, and Vite**, leveraging `@capacitor/android` for native builds.

It was originally written in Godot, then ported to Unity, and finally ported to React to provide a completely responsive, web-first idle experience that deploys seamlessly to Android as a native app bundle (.aab).

## State

| Metric | Status |
|---|---|
| Build System | Vite |
| Frontend | React 18 (Hooks, Context) |
| Native Wrap | Capacitor (`npx cap sync android`) |
| Styling | Tailwind CSS |
| Ad Integration | Capacitor AdMob Plugin (`@capacitor-community/admob`) |
| State Management | React Context (`GameContext.tsx`) |
| Save Storage | LocalStorage (`vanta_eclipse_save_v1`) |

**The porting process** translated the original C# monolithic managers (GameManager, CurrencyManager, etc.) into cohesive React components and contexts (primarily `GameContext.tsx`) which drives the pure functional UI components.

Visual assets from the original Python generators (`tools/`) have been successfully moved to the `public/` folder where they are statically served by Vite and copied directly into the native Android bundle. The legacy Unity directories (`Assets/`, `Packages/`, `ProjectSettings/`, and `.meta` files) were cleanly removed.

## Open / Next Steps

1. **Monetization & AdMob:** The game is currently configured with the official Google AdMob Test Ad Unit ID. You must replace this with your real App ID and Ad Unit ID before production.
2. **Capacitor Configuration:** Update the App Name, bundle ID, and application icons in `capacitor.config.ts` and the Android manifest before pushing the `.aab` to the Google Play Console Closed Testing track.
