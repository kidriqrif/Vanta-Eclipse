# Vanta Eclipse

A portrait idle RPG for Android (Google Play, package
`com.vantrexagames.vantaeclipse`) and the web. The current version is 1.4.0
(Android versionCode 5).

You tap, or let auto-attack fight, to climb levels. Every tenth level is a
30-second boss gate. Kills drop gear and bosses drop cards. Companions level up
from kills and from absorbing cards. Relics drop in the second world. After level 50 the Eclipse
trades the run for permanent crystals. Seven arcade minigames run on a token
meter, and quests and offline earnings fill the time between sessions. The game
plays offline and keeps its progress on the device.

[Architecture](docs/ARCHITECTURE.md) · [Handoff](HANDOFF.md) ·
[Project page](https://kidriqrif.github.io/Vanta-Eclipse/)

**History.** The game was written in Godot, ported to Unity, then ported to
React in Google AI Studio. That AI Studio code did not work. It had side
effects inside React state updaters, it paid boss loot for skipping the fight,
and it shipped a fake Play Games login and purchases that were granted without
payment. It has been rebuilt: the rules now live in a pure, unit-tested
reducer, and the screens sit on top of it. Older engine code is in git history
(see `CLAUDE.md`).

## Stack

| | |
| --- | --- |
| UI | React 18, TypeScript 5, Vite 5 |
| Styling | Tailwind CSS v4. The palette is `@theme` tokens in `src/index.css`. |
| Game state | A pure reducer in `src/game/`, using immer |
| Icons and fonts | lucide-react. Orbitron, JetBrains Mono and Share Tech Mono are bundled via @fontsource, with no CDN. |
| Native | Capacitor 8: @capacitor/android, @capacitor/app (lifecycle, back button), @capacitor/haptics |
| Ads | AdMob via @capacitor-community/admob 8: a banner and opt-in rewarded offers, with UMP consent |
| Purchases | Google Play Billing via @capgo/native-purchases, off until `BILLING_ENABLED` is set |
| Tests | Vitest (unit) and Playwright (end-to-end) |

## Getting started

You need Node 22 or newer (the Capacitor 8 CLI requires it).

```bash
npm ci
npm run dev        # http://localhost:3000
```

In a dev build, the rewarded ad offers simulate a short "watch" so their flows
can be tried in a browser. The store is also exposed as `window.__vanta` for
debugging.

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server on port 3000 |
| `npm run build` | `tsc --noEmit`, then `vite build` into dist/ |
| `npm run preview` | Serves the production build |
| `npm run typecheck` | `tsc --noEmit` (`npm run lint` is the same command; there is no ESLint) |
| `npm test` | Vitest unit tests |
| `npm run e2e` | Playwright smoke tests |
| `npm run android:sync` | `npm run build`, then `npx cap sync android` |
| `npm run graphify` | Rebuilds the code knowledge graph (see `CLAUDE.md`) |

## Tests

```bash
npm test           # Vitest: src/game/__tests__ (reducer, tap guard, save migration)
npm run e2e        # Playwright: e2e/, against a dev server it starts on port 5173
```

The unit tests run the whole ruleset with a fixed clock and a seeded RNG, and
take about a second. The end-to-end tests drive the game in a Pixel 7 portrait
viewport:

- tapping, and every tab opening;
- boss retreat and challenge;
- the autoclicker lockout;
- v1 save migration and doubled offline earnings;
- billing being off;
- ad caps;
- every arcade game paying exactly once.

To use a browser that is already installed instead of
`npx playwright install chromium`, point `PW_CHROMIUM` at it:

```bash
PW_CHROMIUM=/path/to/chrome npm run e2e
```

## Android build (Google Play)

You need Android Studio and JDK 21; the Android project compiles with Java 21.
It builds with compileSdk 36, targetSdk 36 and minSdk 24.

1. Build the web app and copy it into the native project:

   ```bash
   npm run android:sync
   ```

   This writes the web bundle into the Android assets folder. That folder is
   generated and untracked, so run this before every Android build.

2. Open the project with `npx cap open android`, or open the `android/` folder
   in Android Studio.
3. Use **Build → Generate Signed App Bundle / APK → Android App Bundle**, sign
   with your upload key, and upload the app bundle to a Play Console track.

   Keystores and key.properties files are gitignored; keep them out of the repo.

To release a new version, bump `versionCode` and `versionName` in
`android/app/build.gradle` and `version` in `package.json`. `vite.config.ts`
exposes the `package.json` version to the app as `__APP_VERSION__`.

**Before the production release:**

- Put your AdMob ad unit IDs into `src/config/monetization.ts` and set
  `isTesting: false` there.
- Put your AdMob app ID into the `APPLICATION_ID` meta-data in
  `android/app/src/main/AndroidManifest.xml`.
- Both currently hold Google's public sample IDs, which serve test ads only.
- `BILLING_ENABLED` in the same config file turns the paid items on. Until it
  is true they read "COMING SOON". The products must exist in Play Console with
  the `storeId`s from `PRODUCTS` in `src/data/definitions.ts`.

## Where the save lives

The save lives in `localStorage` under the key `vanta_eclipse_save_v1`. The
JSON inside carries `version: 2`. Inside the Android app, that storage is the
WebView's, in the app's private data.

The game also keeps two extra copies:

- `vanta_eclipse_save_backup`, the last save that loaded cleanly;
- `vanta_eclipse_save_v1_premigration`, a one-time copy of an original AI
  Studio save, kept before its first migration.

There is no cloud save. The manifest allows Android Auto Backup, so Android may
restore the data on a reinstall or a new phone. The provider can also export
the save as a string and import one (`exportSave` and `importSave` from
`useControls()`), which is the manual way to move progress.

## Project structure

| Path | Contents |
| --- | --- |
| `src/game/` | The ruleset: state, actions, reducer, stats, loot, tap guard, quests, arcade, offline, save, store and RNG. Pure TypeScript with unit tests in `src/game/__tests__/`. |
| `src/context/GameProvider.tsx` | Creates the store and runs the 100 ms tick, autosave, pause and resume, offline earnings, the Android back button, and sound and haptics. It also initialises ads and billing. |
| `src/hooks/` | `src/hooks/useGame.ts` (state selectors, dispatch, fx), `src/hooks/useMonetization.ts` (ad offers, the Play store, restore), `src/hooks/useBackHandler.ts` |
| `src/services/` | AdMob, Play Billing, Web Audio and haptics wrappers |
| `src/config/monetization.ts` | Ad unit IDs, `isTesting`, `BILLING_ENABLED` |
| `src/data/definitions.ts` | All content: worlds, enemies, upgrades, gear, relics, pets, skills, minigames, quests, products, cosmetics and ad placements |
| `src/types/game.ts` | Types for the content definitions |
| `src/components/` | Header, combat arena, the tab screens (UPGRADES, ARMOR gear, CODEX journal, cards, BEAST companions, relics, Eclipse, Arcade, BAZAAR shop), the modals (settings, Remove Ads, offline rewards, world unlock, onboarding), toasts, the Eclipse overlay and the banner slot. A five-slot nav bar plus a MORE sheet reaches every tab. |
| `src/components/minigames/` | The seven arcade games, their contract (`src/components/minigames/types.ts`) and `src/components/minigames/registry.ts` |
| `src/components/ui/` | Shared primitives: `Panel`, `PanelHeader`, `TabBody`, `Button`, `TwoTapButton`, `Modal` |
| `src/utils/numberFormat.ts` | Every player-facing number goes through this |
| `src/index.css` | Tailwind import and the colour tokens |
| `src/assets/gear/` | Gear slot artwork, bundled by Vite |
| `public/` | Sprites (`public/art/`), sounds and music (`public/audio/`), icons, the web manifest, the web-only service worker, the privacy policy pages |
| `e2e/` | Playwright tests |
| `android/` | The Capacitor Android project |
| `design/` | GDD, UX specs per milestone, accessibility requirements |
| `docs/` | `docs/ARCHITECTURE.md`, and the published project page and privacy policy |
| `production/` | Play Store material: listing text, icons, screenshots |
| `capacitor.config.ts`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig.json` | Tool configuration |
| `.claude/` | Claude Code project files: the graphify skill and the technical preferences |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how the pieces fit
together and how to add content or a minigame. See [HANDOFF.md](HANDOFF.md) for
the current state and what is left before launch.
