# Vanta Eclipse — Architecture

The game is a reducer. Every rule (damage, drops, boss gates, the Eclipse, the
arcade, quests, ad caps, purchases, offline earnings, save migration) lives in
`src/game/` as plain TypeScript with no React and no plugins in it. React only
renders state and turns input into actions. `src/context/GameProvider.tsx`
runs the clock and the side effects, and `src/services/` wraps the native
plugins.

UI owns nothing. A screen reads a slice of the state and dispatches actions.
It never keeps its own copy of game state and never changes it.

```
 input ──▶ dispatch(Action) ──▶ store ──▶ reduce(state, action, { now, today, rng })
                ▲                 │          ├─▶ next state (immer)
                │ ActionResult    │          ├─▶ fx[] (sound, haptic, hit, toast, save, ...)
                └─────────────────┤          └─▶ result (ok / reason / value)
                                  │
 useGameState(selector) ◀─────────┤ notify subscribers, then deliver fx:
                                  │   GameProvider → audio, haptics, save
                                  │   useFx        → damage numbers, shake, toasts, flash
```

## The files in `src/game/`

| File | What it holds |
| --- | --- |
| `src/game/state.ts` | `GameState` and the tuning constants (token cap and regen, boss timer, unlock levels). `createInitialState(now)`. The `ui` slice is session-only and never saved. |
| `src/game/actions.ts` | The `Action` union, the `FxEvent` union (side effects the reducer asks for) and `ActionResult`. |
| `src/game/reducer.ts` | `reduce(state, action, { now, today, rng })` returns `{ state, fx, result }`. It uses immer: handlers write to a draft. It also exports the pure helpers that screens need for display (`upgradeCost`, `affordableUpgrades`, `skillCost`, `skillBlocker`, `eclipsePayout`, `comboBonus`). |
| `src/game/stats.ts` | `selectStats(state)`: tap damage, crit chance and damage, essence multiplier, boss multiplier, auto-attack interval and DPS, the live essence rate and the reward rate. Also enemy HP and essence-per-kill formulas, and pet level and evolution helpers. |
| `src/game/loot.ts` | The one item roller (rarity from `LOOT_TABLES`, rarity + 1 affixes) and the boss-card roller. |
| `src/game/tapGuard.ts` | Autoclicker detection and the escalating lockout. |
| `src/game/quests.ts` | `getQuestProgress`, the single definition of progress used by the claim logic, the Journal and the nav badge. `bumpCounter` feeds the lifetime and daily counters. |
| `src/game/arcade.ts` | Wall-clock token regen, unlock checks, payout, and record direction. |
| `src/game/offline.ts` | The offline reward. |
| `src/game/save.ts` | Load, save, the v1 → v2 migration, `sanitize`, backups, and the storage adapter. |
| `src/game/store.ts` | A small external store: `getState`, `dispatch`, `subscribe`, `onFx`, `replace`. |
| `src/game/selectors.ts` | Derived values for screens (unseen counts, ad offer availability, forge cost, next token). |
| `src/game/rng.ts` | The `Rng` type, `seededRng` for tests, and `pick`, `weightedIndex`, `shuffled`. |

## Reducer, store and fx

`reduce` is a pure function of the state, the action, the time and the
randomness. `now` (wall-clock ms), `today` (the local date, `YYYY-MM-DD`) and
`rng` come in through the context. Nothing in `src/game/` calls `Date.now()` or
`Math.random()`. That is why the tests can run the whole game with a fixed
clock and a seeded RNG. Storage is the one boundary: `src/game/save.ts` talks to a
`SaveStorage` interface, which the provider backs with `localStorage`. The tests
back it with an in-memory object.

Stats are computed once at the start of each action (`selectStats(state)`) and
used throughout it. `selectStats` is memoized on the slices it reads (upgrades,
equipped gear, pets, active pet, active relic, skills, current level, run
peak). Immer keeps untouched slices referentially equal, so the ten ticks a
second hit the memo. **If you add a stat input from another slice, add that
slice to the memo key in `src/game/stats.ts`**, or the stat will go stale.

The reducer never performs a side effect. It pushes `FxEvent`s instead:

| fx | Who handles it |
| --- | --- |
| `sound` | GameProvider → `audio.play(id)` |
| `haptic` | GameProvider → `impact(strength)` (the reducer only emits it when haptics are on) |
| `save` | GameProvider → writes the save immediately |
| `hit` | CombatArena → hit animation, and a damage number at the tap position when Damage Numbers is on (auto-attack hits carry no position and appear near the enemy) |
| `shake` | CombatArena (only emitted when Screen Shake is on) |
| `toast` | ToastHost |
| `tapLocked` | No listener needs it today: the arena's lockout overlay reads `ui.tapGuard.lockedUntil` from state |
| `eclipse` | EclipseOverlay |

`createGameStore` in `src/game/store.ts` runs the reducer synchronously. It
commits the new state and notifies subscribers, then delivers the fx, then
returns the `ActionResult` to the caller. A button can therefore check
`dispatch(...).ok` or `.reason` ("not_enough", "locked", "capped", ...)
immediately, and no side effect ever runs inside a React state updater.

### Reading and acting from React (`src/hooks/useGame.ts`)

- `useGameState(selector, equal?)` subscribes through `useSyncExternalStore`. A
  component re-renders only when its selected value changes. Return a primitive
  or an existing state object. If the selector builds a new object, pass
  `shallowEqual`.
- `useStats()` returns the derived stats.
- `useDispatch()` returns `dispatch`, and with it the `ActionResult`.
  `useAction` wraps a fixed action shape in a stable callback.
- `useFx(handler)` listens to reducer side effects for visuals.
- `useNow(ms)` and `useToday()` give a wall clock for countdowns and daily caps.
- `useControls()` exposes `saveNow`, `exportSave`, `importSave` and `resetSave`.

`src/hooks/useMonetization.ts` has `useAdOffer`, `useStore` (the Play Billing
store, not the game store: that one is `useGameStore`), `useRestorePurchases`,
`useBannerHeight` and `usePrivacyOptionsRequired`.

## One tap, end to end

1. **Input.** The combat arena handles `pointerdown` and dispatches
   `{ type: 'TAP', x, y, touch }`, where `touch` says whether the pointer was a
   finger.
2. **Store.** `dispatch` stamps `now = Date.now()` and `today`, then calls
   `reduce`.
3. **Tap guard.** The `TAP` handler first calls `registerTap` in
   `src/game/tapGuard.ts`:
   - `locked`: the tap is ignored. No damage, and no quest counter.
   - `flagged`: the combo resets, `tapLocked` (until, signal) and the `fail`
     sound go out, and the result is `fail('flagged')`.
   - `ok`: the combo count goes up (it resets after a 1.5 s gap), the `taps`
     counter is bumped, and `applyHit` runs.
4. **applyHit.** It rolls a crit against `critChance` and applies the boss
   multiplier if the enemy spawned as a boss. Manual taps also get the combo
   bonus: +2% per 3 consecutive taps, capped at +25%. Damage is
   `max(1, round(tapDamage × crit × boss × (1 + combo)))`. It pushes `hit` and
   `tap_hit` or `crit_hit`. A manual crit also pushes `shake` and a light
   haptic. Then the enemy loses HP.
5. **Kill.** At 0 HP, `onKill` plays `enemy_death`, bumps `kills` and gives the
   active pet XP.
   - A normal enemy pays `essencePerKill`, sometimes drops an item
     (`ENEMY_DROP_CHANCE`), then climbs a level, or respawns the same level in
     farm mode.
   - A boss pays boss essence and always drops a card and an item from the boss
     loot table. It may also drop a relic or the Frostling (World 2 only), or an
     arcade token. Then the climb continues. Beating the level-50 boss unlocks
     the Frozen Ruins, awakens relics, grants Ember and requests a save.
   - Entering a level that is a multiple of 10 starts a boss fight
     (`boss_warn`, 30 s timer).
6. **Commit.** The store swaps in the new state, and every component whose
   selected slice changed re-renders: HP bar, essence, level.
7. **Effects.** GameProvider plays the sounds through `src/services/audio.ts`.
   That service drops rapid repeats of the same sound, so auto-attack never
   machine-guns. It also fires haptics if they are enabled. CombatArena plays
   the hit animation and, if Damage Numbers is on, draws the number at
   `(x, y)`. ToastHost shows any drop toasts.
8. **Result.** `dispatch` returns `{ ok: true }`, or the failure reason.

## The tick and the two clocks

GameProvider dispatches `TICK` every 100 ms with the **measured** elapsed time
(`performance.now()` deltas). It does not tick while the app is in the
background. The reducer clamps one tick to at most 1 s, so a stall is never
replayed as a burst. Each `TICK`:

- rolls the daily quests over when the local date changes;
- brings the arcade token meter up to date from the wall clock;
- expires the combo after 1.5 s without a tap;
- counts the boss timer down, **unless a minigame run is open**. On timeout the
  player drops to farm the level below the gate;
- accumulates auto-attack time and lands one hit per `autoAttackInterval`, at
  most 20 per tick.

Two clocks therefore exist:

- Game time (tick `dt`) drives combat: the boss timer and auto-attack. It stops
  in the background.
- Wall-clock time (`now`) drives everything that must keep running while the
  app is closed: token regen, the offline reward, daily rollover, ad caps, the
  tap guard and its lockout.

## Combat states

`combat.mode` is `NORMAL` (climbing), `BOSS_FIGHT` (a timed gate) or
`FARM_MODE` (kills repeat the level).

- `LEAVE_BOSS` (RETREAT) and a timeout both drop the player to farm the level
  below the gate (M5 §2C).
- `CHALLENGE_BOSS` re-fights the gate. It only works from farm mode on the
  level just below a gate.
- `SET_FARM` (HOLD LEVEL) farms by choice. It is refused during a boss fight.

Boss status comes **only** from how the enemy spawned (`enemy.isBoss`, set by
`spawnEnemy`). The AI Studio build paid boss loot for skipping the fight. A
loaded save never resumes inside a running boss timer: `withFreshEnemy` puts a
save that stopped on a gate one level below, in farm mode.

Auto-attack unlocks at run level 15 (`AUTO_ATTACK_UNLOCK_LEVEL`), or from the
start with the Eternal Reflex skill.

The Eclipse (`PERFORM_ECLIPSE`) needs a run peak of at least 50. It pays
floor((peak ÷ 10) ^ 1.6) × (1 + Crystalline) void crystals, rounded, at least
1. It resets essence, upgrades, level, run peak, world unlocks and auto-attack,
and keeps everything else (M8 §1). It saves immediately.

## Saving and migration

All of this is in `src/game/save.ts`.

- **Where.** The save lives in `localStorage` under the key
  `vanta_eclipse_save_v1`. On Android that is the WebView's storage in the
  app's private data. The key name predates the versioned format. The
  `version` field inside (currently `2`, `SAVE_VERSION`) tells the formats
  apart, and the original AI Studio saves have no `version` field.
- **What.** `serialize` writes everything except the session-only `ui` slice,
  stamped with `savedAt`.
- **When.** GameProvider saves:
  - every 5 s if anything changed;
  - immediately on a `save` fx, which the reducer requests after the Eclipse,
    the Frozen Ruins unlock, arcade start and finish (so killing the app
    mid-game cannot refund a token), ad rewards, and purchases and restores;
  - when the app goes to the background (`visibilitychange`, `pagehide`, and
    the Capacitor `pause` event).
- **Loading** (`loadGame`):
  1. The main save is parsed. A save without a `version` goes through `fromV1`
     first.
  2. `sanitize` turns any parsed object into a valid `GameState`, and never
     throws:
     - it clamps numbers;
     - it drops ids that no longer exist in the definitions;
     - it caps levels at `maxLevel`, the card collection at 200 and the token
       count at 99;
     - it never lets `savedAt` or the token regen anchor lie in the future;
     - it keeps only non-consumable entitlements, and keeps the dailies only
       if they are from today.
  3. A successful load also copies the raw save to `vanta_eclipse_save_backup`.
     The first load of a v1 save keeps a one-time copy in
     `vanta_eclipse_save_v1_premigration`.
  4. If the main save does not parse, the backup is loaded. If neither does, a
     new game starts.
- **The v1 migration drops two things on purpose.** It drops minigame records,
  because v1 recorded losses and kept some records in the wrong direction. It
  also drops the Remove Ads and Starter Pack entitlements, because v1 granted
  them without payment. Their contents (crystals, tokens, the Ember Trail) stay
  with the player.
- **Export, import and reset** go through `useControls()`. Import runs the same
  `deserialize` path as a load, so an old string is migrated and sanitized too.
- **Adding a persisted field.** Add it to `GameState`, to `createInitialState`,
  **and to `sanitize`**. `sanitize` builds the state from a fresh base, so a
  field it does not read is reset to its default on every load. A change that
  cannot be expressed as "missing means default" needs `SAVE_VERSION` bumped
  and a branch in `deserialize`, like `fromV1`. Add a case to
  `src/game/__tests__/save.test.ts` either way.

Saves are local only. There is no cloud save. The manifest has
`android:allowBackup="true"`, so Android Auto Backup may restore the app's data
on a reinstall or a new device. Google decides when that happens.

## Offline earnings

`computeOfflineReward` in `src/game/offline.ts`:

- It pays nothing under 60 s, and nothing until auto-attack is running.
- It pays `liveEssenceRate × seconds × efficiency`, at the level the player
  left on. Farming a walled boss pays the farm rate (M5 §6).
- The cap is 8 h plus Long Slumber. Efficiency is 50% plus Deep Rest. The
  Eclipse Heart relic, when attuned, triples the amount.

It is applied at launch, measured from `savedAt` (M4 §2B). It is also applied
on resume after at least 60 s in the background, measured from the moment the
app paused. `APPLY_OFFLINE` adds the essence straight away and records
`ui.pendingOffline` for the modal. The `offline_double` ad pays the same amount
once more, only while that pending reward is undoubled.

## Arcade

The arcade unlocks at lifetime level 20 (`ARCADE_UNLOCK_LEVEL`). Each game
unlocks against the lifetime peak, so an Eclipse never re-locks one.

- **Tokens.** There are 5 tokens. One regenerates every 30 min, from
  wall-clock time, so the meter fills while the app is closed. A clock set
  backwards grants nothing. Rewards from quests, ads and the Starter Pack may
  overflow the cap. Regen and boss drops may not.
- **The run lifecycle:**
  1. `ARCADE_START` (dispatched by `ArcadeHub` when PLAY is tapped) spends
     the token, opens `ui.activeRun` with a fresh `runId`, and saves.
  2. While a run is open, a boss fight is held (`isBossHeld`): the timer
     stops, auto-attack skips the boss, and taps fail. Ordinary enemies keep
     being farmed. The offline and world-unlock dialogs hold a boss the same
     way.
  3. `ARCADE_FINISH` pays only if its `runId` matches the open run, and only
     once. That is the latch.
  4. `ARCADE_QUIT` closes the run, pays nothing and forfeits the token.
     Leaving the Arcade tab with a run open quits it too.
- **Payout** is `rewardRate × rewardSeconds × performance`. A loss pays 25% of
  that, and every result pays at least 1 (M9 §2). `rewardRate` uses the same
  formula as the live essence rate, but exists before auto-attack unlocks.
- **Records** count only from wins, in each game's direction (`lowerIsBetter`).

## Monetization layer

The spec is `design/ux/milestone-14-monetization.md`. The code is in three
places.

**`src/config/monetization.ts`** holds every switch:

- the banner and rewarded ad unit IDs (currently Google's public sample IDs);
- `isTesting`;
- `BILLING_ENABLED`, which is `false`.

At launch this file and the AdMob `APPLICATION_ID` in
`android/app/src/main/AndroidManifest.xml` (also a sample ID today) are the
only code to change.

**`src/services/ads.ts`** wraps @capacitor-community/admob:

- **Start-up order.** `initialize`, then the UMP consent request (Google's form
  is shown where the law requires it), then ads are requested only if consent
  allows. `showPrivacyOptions()` reopens Google's privacy options form, and
  `usePrivacyOptionsRequired()` tells Settings when UMP requires that entry
  point.
- **Banner.** An adaptive banner sits at the bottom. `BannerSlot` reserves its
  height plus a 12 px gap above the nav, and `Modal`, `MinigameHost` and
  `ToastHost` pad by the same height, so the banner never covers the game.
  A banner that fails to load is retried with backoff (30 s up to 5 min). It
  is removed once Remove Ads is owned.
- **Rewarded.** Rewarded videos are opt-in. `showRewarded()` resolves
  `'rewarded'` only after AdMob's reward event. It gives up if the video has
  not started within 60 s; once it is on screen, only a dismiss or a failure
  ends it.
  There are no interstitials.
- **On the web** there is no ad network, so offers are unavailable. A dev build
  (`npm run dev`) simulates a 1.2 s watch so the flows can be tested in a
  browser.

**`useAdOffer(placementId)`** runs an offer: video (or instant with Remove Ads),
then `AD_REWARD`. The reducer refuses once the daily cap is reached. The watch
is counted **after** the grant, so a watch that yields nothing never uses up an
offer. The caps apply even with Remove Ads, which only skips the video. The
placements are in `ADS` in `src/data/definitions.ts`:

| Placement | Where it is offered |
| --- | --- |
| `offline_double` | only in the offline modal |
| `arcade_token` | in the Arcade, when out of tokens |
| `essence_boost` | in the Shop |

There is no ad penalty for autoclicking: an ad shown to a bot gets clicked by
the bot, and AdMob treats that as invalid traffic.

**`src/services/billing.ts`** wraps @capgo/native-purchases:

- **Availability.** While `BILLING_ENABLED` is false, or off-device, the store
  reports unavailable and paid items read "COMING SOON". Prices come from Google
  Play (`priceOf`) and are never hard-coded.
- **Buying.** `purchase()` returns `'purchased'` only for a purchased state.
  The order is fixed so a crash never loses or duplicates a purchase: the hook
  dispatches `PURCHASE_GRANTED` with the transaction id, the game saves, and
  only then does `finalize()` acknowledge an entitlement (`remove_ads`,
  `starter_pack`) or consume a shard pack (`shards_small`). `PURCHASE_GRANTED`
  is idempotent: the last 200 transaction ids are kept in
  `shop.processedTransactions`, and a repeat grants nothing. Play's "already
  owned" answer (`'owned'`) runs a restore instead.
- **Restoring.** `syncPurchases()` in `src/hooks/useMonetization.ts` asks
  `reconcile()` for every paid purchase Play still holds, grants each through
  `PURCHASE_GRANTED`, then finalizes it. It runs at launch, on resume (at most
  once a minute), after a save import or reset, and from Settings → Restore
  purchases. That is also how a pending payment that cleared later, or a
  purchase that was never finalized, gets granted. `reconcile()` throws when
  Play cannot be reached, so Settings never says "nothing to restore" for a
  network error.
- **Imports keep this device's purchases.** Importing a save, or resetting,
  keeps `entitlements`, `processedTransactions` and `adWatches` from the
  current device, so a save file cannot carry purchases or reset the ad caps.
- **Validation.** There is no server-side receipt validation (the game has no
  server).

## Platform glue

- **Lifecycle.** GameProvider listens to `visibilitychange`, `pagehide` and, on
  Android, @capacitor/app `pause` and `resume`. On pause it saves and
  suspends audio. On resume it restarts audio, applies offline time, retries
  any ads or billing start-up that failed (offline at launch, say), and syncs
  purchases at most once a minute.
- **One tab owns the save (web).** Each mount writes its own id to
  `vanta_eclipse_owner`, and only the owner saves. A second tab of the web
  build takes over: the first stops ticking and saving and shows "OPEN IN
  ANOTHER TAB" with a PLAY HERE INSTEAD button, so two tabs never overwrite
  each other's progress. On Android there is only ever one WebView.
- **Back button.** `useBackHandler(active, handler)` in
  `src/hooks/useBackHandler.ts` keeps a stack, and the newest active handler
  wins. `Modal` registers itself. App registers "go back to the home tab". With
  nothing registered, back minimizes the app.
- **Audio.** `src/services/audio.ts` plays the WAVs in `public/audio/` through
  Web Audio. Nothing loads before the first gesture.
- **Haptics.** `src/services/haptics.ts` uses @capacitor/haptics on device
  and `navigator.vibrate` on the web.
- **Service worker.** `public/sw.js` is network-first and is registered only by
  the installable web build. `src/main.tsx` unregisters it inside the Android
  app.
- **Dev handle.** Dev builds put the store on `window.__vanta`, for the
  Playwright tests and for console debugging.

## Mobile-first conventions

- The layout is a single portrait column (max width `max-w-md`) that respects
  the safe-area insets. The Android activity is locked to portrait.
- Touch targets are at least 32 CSS px tall. `Button` sizes are 32, 40 and 48
  px. 32 CSS px is the 96 px of the 1080-wide reference canvas in
  `design/accessibility-requirements.md`, on a 360 px-wide screen.
- No state is conveyed by colour alone.
- Every overlay closes with the back button.
- Destructive or expensive actions use `TwoTapButton`: the first tap arms it,
  the second commits.

## Adding content

All content is data in `src/data/definitions.ts`. The types are in
`src/types/game.ts`. Screens render whatever is in the lists, so most additions
need no component change.

| To add | Edit | Watch for |
| --- | --- | --- |
| Upgrade | `UPGRADES` | `stat` must be one `compute()` in `src/game/stats.ts` reads (`tap_damage`, `crit_chance`, `crit_damage`, `essence_gain`). `maxLevel: 0` means no cap. A new stat needs a line in `compute()`, and a memo-key entry if it reads a new slice. |
| Enemy or boss | `ENEMIES`, plus the id in a world's `enemyIds` or `bossIds` in `WORLDS` | Bosses rotate by gate: index floor((level − 1) ÷ 10) mod the list length. Sprites go in `public/art/enemies/`. |
| Relic | `RELICS` | `effectId` must be one the code reads: `offline_mult`, `essence_mult`, `crit_dmg`, `boss_pct`, `attack_speed`. |
| Pet | `PETS` | It needs a way to be granted. Today only Ember (Frozen Ruins unlock) and the Frostling (World 2 boss drop) are, both in `src/game/reducer.ts`. |
| Skill | `SKILLS` | `effectStat` only does something if code in `src/game/` reads it, usually through `skillStat(...)`. Eternal Reflex is checked by id instead. |
| Quest | `QUESTS` | `metric` must be a counter that `bumpCounter` feeds, or one of the computed metrics in `getQuestProgress`. Daily metrics are `daily_<counter>`, and a new daily must also be added to a pool in `getDailyQuestIdsForDate`. |
| Gear affix | `AFFIXES` | Its `stat` must be read through `affixSum(...)` in `src/game/stats.ts`. |
| Product | `PRODUCTS` | `storeId` must match the Play Console product, `consumable` must match how it is sold, and there is no price field. |
| Cosmetic | `COSMETICS` | Colours here are content, not theme. |
| Ad placement | `ADS` | A new `rewardKind` needs a branch in the `AD_REWARD` handler. |
| Sound | `SoundId` in `src/game/actions.ts`, the list in `src/services/audio.ts`, and a WAV in `public/audio/sfx/` | |

Removing or renaming an id is safe for old saves: `sanitize` drops ids it no
longer knows.

Any new rule goes in `src/game/` with a test, never in a component.

## Adding a minigame

1. **Write the component** in `src/components/minigames/`. It implements the
   contract in `src/components/minigames/types.ts`:
   - It takes `onFinish` and calls it **once** with
     `{ won, performance (0..1), score, detail }`.
   - It never touches currency, tokens or saves.
   - The host unmounts it after the result, so clear every timer in an effect
     cleanup.
   - The `score` is in the unit and direction its definition declares. Use
     `clamp01` for `performance`.
2. **Register it** with one line in `src/components/minigames/registry.ts`:
   `my_game: MyGame`.
3. **Add a `MINIGAMES` entry** in `src/data/definitions.ts` with the same `id`:
   - `displayName`, `description`, and an `icon` under `public/art/`;
   - `unlockLevel` (against the lifetime peak), `rewardSeconds` and
     `tokenCost`;
   - `lowerIsBetter` and `scoreUnit`, which set the record direction and its
     label;
   - `sortOrder`.

`ArcadeHub` dispatches `ARCADE_START`. The minigame host
(`src/components/minigames/MinigameHost.tsx`) owns everything after that: the
latch on the first result, `ARCADE_FINISH` or `ARCADE_QUIT`, and the result
banner. While it is open it marks the rest of the app `inert`
(`src/hooks/useArcadeOverlay.ts`), and the offline, world-unlock and tutorial
dialogs wait until it closes. `e2e/arcade.spec.ts` plays every
`MINIGAMES` entry by tapping random points until a result appears. A new game
is covered automatically, as long as random taps (or its own timer) can bring
it to an outcome.

## Testing

- **`npm test`** runs Vitest on every .test.ts file under `src/`, in Node. The
  tests are in `src/game/__tests__/`:
  - `src/game/__tests__/reducer.test.ts`: combat and gates, spending, gear,
    pets, the Eclipse, the arcade latch and payout, token regen, quests, ad
    caps, purchases and offline;
  - `src/game/__tests__/save.test.ts`: v1 migration, backups and corrupt
    saves, round-trips;
  - `src/game/__tests__/tapGuard.test.ts`: the autoclicker signals, lockout
    escalation and forgiveness.

  `src/game/__tests__/helpers.ts` provides `newGame()` and `harness()`, which
  give a fixed clock you can advance and a seeded RNG. Every change to a rule
  gets a test here.
- **`npm run e2e`** runs Playwright in `e2e/` against a Vite dev server on port
  5173, which it starts itself or reuses. It uses a Pixel 7 portrait profile,
  and reads and patches state through `window.__vanta`. To use an installed
  browser instead of `npx playwright install chromium`, set the `PW_CHROMIUM`
  environment variable to its executable.
- **`npm run typecheck`** runs `tsc --noEmit`. `npm run lint` is the same
  command; there is no ESLint.
- **Device-only behaviour** must be checked on a phone: AdMob and consent,
  billing, the back button, haptics, pause and resume, and Auto Backup.
