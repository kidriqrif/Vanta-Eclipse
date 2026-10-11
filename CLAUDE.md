## Git workflow

**All work happens directly on `main`.** There are no feature branches: commit
to `main` and push with `git push origin main`. Do not create branches or pull
requests unless the owner asks for one in that session. This overrides any
default instruction to develop on a separate branch.

GitHub Pages publishes `docs/` from `main`, so a push to `main` also updates the
live privacy policy (https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html).
`docs/privacy-policy.html` is the only copy; the game links to the live page.

Before pushing, run `npm run typecheck`, `npm test` and `npm run e2e` (CI runs
them too, plus `npm run build`).

## Where things are written down

| File | Purpose |
| --- | --- |
| `README.md` | What the game is, how to run, test, build and release it |
| `docs/ARCHITECTURE.md` | How the code fits together; how to add content or a minigame |
| `design/game-design.md` | Design intent, player journey, the accessibility bar |
| `production/release-checklist.md` | What is missing for production, the ads/billing switch, the device test checklist |
| `production/play-console.md` | Paste-ready Play Console answers, store listing and release notes |

Keep it to these. Add to the right one instead of starting a new document.

## Code rules

- **Components never mutate game state.** Read with `useGameState(selector)` or
  `useStats()` from `src/hooks/useGame.ts`; act with `useDispatch()` and use the
  `ActionResult` it returns. Local `useState` is for UI only (open, selection,
  animation). Selectors return stable values or pass `shallowEqual`, so the
  100 ms tick does not re-render screens.
- **Rules live in `src/game/`** and get a unit test in `src/game/__tests__/`
  (`harness()` in `src/game/__tests__/helpers.ts` gives a fixed clock and a
  seeded RNG). Nothing in `src/game/` calls `Date.now()` or `Math.random()` or
  imports React or a plugin. Side effects leave the reducer as `FxEvent`s;
  `src/context/GameProvider.tsx` plays sounds and haptics.
- **Content is data** in `src/data/definitions.ts` (types in `src/types/game.ts`).
  Never hard-code a list of upgrades, quests or products in a component. Store
  prices come from Google Play only.
- **Player-facing numbers** go through `src/utils/numberFormat.ts`.
- **Colours** are the theme tokens in `src/index.css` as Tailwind classes
  (`bg-panel`, `text-neon`, `border-line` ...), never hex in a component.
  Item rarity uses the `r0`–`r4` tokens (`border-r3`, `bg-r3/15`); trail
  colours are data.
- **The look is a native game, not a web page:** flat fills, one-pixel borders
  and hard offset shadows (`shadow-hard`, `shadow-hard-lg`). No gradients,
  glows, blur or rounded pills. Buttons are sharp rectangles that sink when
  pressed (the `Button` primitive and the `.hud-btn*` classes).
- **Type:** `font-display` (Orbitron) for headers, the stage track and alerts;
  `font-mono-code` (JetBrains Mono) for every number; `font-tech` (Share Tech
  Mono) for copy, labels and button text. No sans-serif.
- **Layout:** `src/App.tsx` is a fixed, unscrollable frame of three zones: the
  arena (45%), the data ticker (5%) and the tab deck (50%), inside the
  safe-area insets. Only a tab's `TabBody` scrolls.
- **UI primitives** in `src/components/ui/`: `Panel`, `PanelHeader`, `TabBody`,
  `Button`, `TwoTapButton` (destructive or expensive actions) and `Modal` (wires
  the Android back button). Any other overlay registers its own back handler
  with `useBackHandler`.
- **Touch targets** are at least 32 CSS px; never show state by colour alone
  (`design/game-design.md`).
- **Timers** are cleared in effect cleanups; minigames unmount mid-play.
- **Monetization switches** live only in `src/config/monetization.ts`, plus the
  AdMob app ID in `android/app/src/main/AndroidManifest.xml`. Ads are opt-in
  rewarded offers with daily caps plus one banner; never interstitials, never a
  penalty.

## History

The game was written in Godot, ported to Unity, then to React. To recover old
code: Godot is the `godot-final` tag on origin (`git fetch origin tag
godot-final`, then `git show godot-final:<path>`); the Unity C# was deleted by
commit 35935fb (`git show 35935fb^:<path>`). The milestone UX specs that the
1.4.0 rebuild followed were removed later; `git log --all -- design/ux`
finds them.

**Backticks mean a live path**, one that exists in the repo now. Name a
historical file in bold and generated output (dist/, the synced Android web
bundle) in plain text. Check backticked paths with `git ls-files` before
committing.
