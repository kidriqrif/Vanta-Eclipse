# Vanta Eclipse — Technical Preferences

## Stack

- **App:** React 18, TypeScript 5 and Vite 5. The game state is a pure reducer
  in `src/game/`, using immer, behind a small external store. There is no
  Redux, and React context carries only the store and the save controls, never
  the state itself.
- **Styling:** Tailwind CSS v4. The palette is `@theme` tokens in
  `src/index.css`. Fonts are bundled through @fontsource (Orbitron, JetBrains
  Mono, Share Tech Mono). Icons are lucide-react.
- **Native:** Capacitor 8 on Android: @capacitor/app for lifecycle and the
  back button, and @capacitor/haptics. AdMob comes through
  @capacitor-community/admob, and Play Billing through
  @capgo/native-purchases. Ads, billing and haptics are reached only through
  `src/services/`. Only `src/context/GameProvider.tsx` (lifecycle, back button)
  and `src/main.tsx` (platform check) import Capacitor directly.
- **Tooling:** Node 22 or newer. Vitest for unit tests, Playwright for
  end-to-end tests.
- **TypeScript strictness:** `tsconfig.json` still has `strict: false`, because
  the older screens are not strict-clean. Everything in `src/game/`,
  `src/context/`, `src/hooks/`, `src/services/` and `src/config/` passes
  `npx tsc --noEmit --strict`. New code must pass it too.

Read `docs/ARCHITECTURE.md` before making an architectural decision. It
describes the reducer, store and fx flow, the tick, saving, offline earnings,
monetization, and how to add content or a minigame.

## Project-wide rules

These apply to every feature.

- **Components never mutate game state.**
  - Read with `useGameState(selector)` (or `useStats()`) from
    `src/hooks/useGame.ts`.
  - Act with `useDispatch()` and use the `ActionResult` it returns. Do not
    guess whether an action succeeded.
  - Do not copy game state into `useState`. Local state is for UI only: open or
    closed, the current selection, animation.
- **Game rules live in `src/game/` and get a unit test** in
  `src/game/__tests__/`. The `harness()` in `src/game/__tests__/helpers.ts`
  gives a fixed clock you can advance and a seeded RNG.
  - Nothing in `src/game/` calls `Date.now()` or `Math.random()`, or imports
    React or a plugin. Time and randomness come in through the reducer context.
  - Side effects go out as `FxEvent`s.
- **Content is data** in `src/data/definitions.ts`, with types in
  `src/types/game.ts`.
  - Screens render the definition lists; never hard-code a list of upgrades,
    quests, products and so on in a component.
  - Store prices come from Google Play and are never written in the code.
- **All player-facing numbers** go through `src/utils/numberFormat.ts`
  (`formatNumber`, `formatPercent`, `formatDuration`). Do not use `toFixed` or
  `toLocaleString` in components.
- **Colours come from the theme tokens** as Tailwind classes (`bg-panel`,
  `text-neon`, `border-line` ...), never hex literals in a component.
  - The tokens are `void`, `abyss`, `panel`, `panel2`, `active`, `line`, `ink`,
    `dim`, `faint`, `neon`, `neon-bright`, `gold`, `crimson`, `purple` and
    `toxic`.
  - Colours that are content, such as rarity tiers, card tiers and cosmetic
    trails, are data in `src/data/definitions.ts`.
- **Use the ui primitives** in `src/components/ui/` before styling raw
  elements:
  - `Panel`, `PanelHeader` and `TabBody` for screen layout;
  - `Button`, which has variants and sizes;
  - `TwoTapButton` for destructive or expensive actions (the first tap arms it,
    the second commits);
  - `Modal`, which wires the Android back button through `useBackHandler`. Any
    other overlay must register its own back handler.
- **Touch targets are at least 32 CSS px.** `Button` sizes are 32, 40 and 48 px
  tall. The design is for a portrait phone in a `max-w-md` column, and
  respects the safe-area insets.
- **Never convey state by colour alone** (`design/accessibility-requirements.md`).
  Pair colour with text, an icon, a shape or motion. For example, a locked item
  should say LOCKED, and a rarity should show its name or pips as well as its
  colour.
- **Haptics and sounds** are requested by the reducer as fx and played by
  GameProvider, which respects the player's settings. Components do not call
  `src/services/audio.ts` or `src/services/haptics.ts` for game events.
- **Monetization switches** live only in `src/config/monetization.ts`, plus the
  AdMob app ID in `android/app/src/main/AndroidManifest.xml`. Ads are opt-in
  rewarded offers with daily caps, plus one banner. There are no interstitials,
  and no ad is ever used as a penalty.

## UI review brief

When a UI change needs a review pass, brief the reviewer to check:

- that the component only reads selectors and dispatches actions;
- that selectors return stable values (or pass `shallowEqual`), so the 100 ms
  tick does not re-render the screen;
- that it uses theme tokens and the ui primitives, with no hex literals;
- that numbers go through `src/utils/numberFormat.ts`;
- that touch targets are at least 32 px;
- that every state has a non-colour signal;
- that the back button closes anything the change opens;
- that every timer is cleared in an effect cleanup (minigames are unmounted
  mid-play);
- that there is no per-tick allocation-heavy work in render, since low-end
  Android WebViews are the target.
