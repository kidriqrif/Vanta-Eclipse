# Handoff — Vanta Eclipse

**Snapshot: 1.4.0 (Android versionCode 5), October 2026.** Branch `claude/friendly-faraday-y1r7l9`.

This is the state of the game after the rebuild of the Google AI Studio port. Read
this first; then `README.md` (how to run), `docs/ARCHITECTURE.md` (how it fits
together) and `design/RELEASE-CHECKLIST.md` (what is left before production).

## What changed in 1.4.0

The AI Studio build compiled but did not work. Everything below was fixed by
rebuilding the rules as a pure, unit-tested reducer (`src/game/`) and moving every
screen onto it.

| Area | Was | Now |
| --- | --- | --- |
| Game state | One 1.8k-line context; side effects inside React state updaters; purchases could take the currency and grant nothing; kill rewards could run twice | `src/game/reducer.ts`: every action is a pure transition with a synchronous result; side effects run after the commit |
| Bosses | ABORT paid full boss loot without the fight; ENGAGE/RETRY BOSS farmed boss loot on any level | A boss is only ever the timed gate fight; RETREAT farms the level below; CHALLENGE BOSS re-fights the gate; world bosses (every 50th level) drop Epic or better; a boss is held while a minigame or a dialog covers it |
| Autoclicker | 15 taps/s → 10 s lockout (slow bots passed, fast humans got caught). There was never an ad penalty | Rhythm, burst-rate and pixel-perfect-repeat detection (`src/game/tapGuard.ts`); lockout of manual taps 10 s → 30 s → 60 s; no ad (a bot would click it — AdMob invalid traffic) |
| Arcade | Rune Sweeper took a token and froze the app; 6 of 7 games could pay out repeatedly; Connect Four soft-locked on a draw; records backwards | One result per run (host latch + reducer latch); all 7 games fixed; records from wins only, in the right direction; wall-clock token regen; unlock levels enforced |
| Quests | Level/pet/relic/skill quests showed 0 progress and could never be claimed, blocking the chain | One progress function used by claims, the Journal and the badge |
| Gear / pets / relics / Eclipse | Forge showed 50, charged 20; items duplicated on unequip; salvage silently failed on equipped items; Deep Rest did nothing; no relic detach; Eclipse warnings incomplete | All fixed; compare table, rarity words + pips, NEW badges, full RESET/KEPT lists, two-tap confirms |
| Money | Remove Ads / Starter Pack / Shards granted free at mismatched prices; Remove Ads lifted daily ad caps; offline "double" needed no ad | Play Billing behind `BILLING_ENABLED` (off → "COMING SOON"); grants are idempotent per transaction and finalized only after saving; a pending payment that clears later is granted at the next launch or resume; "already owned" restores; imports cannot carry purchases; caps always apply and survive a clock set backwards; double needs a rewarded ad |
| Ads | Sample IDs; no consent; init raced the banner; rewarded ads hung on web; fake "sponsor" banner | `src/services/ads.ts`: init → UMP consent → banner + opt-in rewarded, retried after a failure; the banner never covers the game or a dialog; fake banner removed |
| Play Games | Web OAuth popup (blocked in Android WebViews) + a "sandbox" fake player | Removed. Codex FEATS remain as in-game achievements |
| Audio / feel | Synthesized beeps; the real WAVs unused; music never started; haptics and screen shake did nothing; combo bonus and cosmetics did nothing | Real audio (pauses in background), haptics, shake, combo damage, cosmetic tap trails and number colours |
| Saves | Saved every 3 s only when nothing changed for 3 s; no save on pause; partial saves crashed the header | Autosave + save on pause/Eclipse/purchase; versioned save with v1 migration, sanitizing and a backup copy; on the web, one tab owns the save |
| Android | Stale v1.2 dev bundle committed; default Capacitor icon and splash; no portrait lock; service worker could serve an old build after updates | Generated bundle untracked; launcher icon + splash from the game's art; portrait + `appCategory="game"`; service worker on web only |
| Docs / tools | Unity-era docs; a regex imitation of graphify; privacy policy said "no ads" | Docs rewritten for this build; the real graphify CLI; one accurate privacy policy |

v1 saves migrate automatically (a one-time copy is kept under
`vanta_eclipse_save_v1_premigration`). Two things are deliberately not carried over:
minigame records (v1 recorded losses and some backwards), and "Remove Ads"/"Starter
Pack" that v1 granted without payment (their crystals, tokens and trail stay).

## Verified

- `npm run typecheck` — clean, `strict` on.
- `npm test` — the game-core unit suites in `src/game/__tests__/`.
- `npm run e2e` — Playwright in Chromium at phone size: the core loop, every tab,
  the boss gate, the autoclicker lockout (and no lockout for human tapping), a v1 save
  migrating plus the offline double, shop honesty, ad caps, all seven minigames played
  to a natural outcome with exactly one payout, a boss held while a minigame is open,
  quit/forfeit, and a second web tab taking over the save.
- `npm run build` — production bundle builds.
- Not verifiable here (no Android SDK or device in this environment): the Gradle build,
  real AdMob ads and the consent form, Play Billing, haptics, the back button on a
  device. `design/TESTING-GUIDE.md` has the device checklist.

## The two switches for launch

Everything monetization-related is in `src/config/monetization.ts`, plus the AdMob app
id in `android/app/src/main/AndroidManifest.xml`:

1. **AdMob** — replace Google's sample IDs with your own app/banner/rewarded IDs, set
   `isTesting: false`, publish app-ads.txt, configure the consent message in AdMob.
2. **Billing** — create `vanta_remove_ads`, `vanta_starter_pack` (non-consumable) and
   `vanta_shards_small` (consumable) in Play Console, then set `BILLING_ENABLED = true`.
   Products can be created and license-tested on the closed testing track before
   production access; it does not have to wait for the 12-testers/14-days gate.

Full runbook: `production/monetisation-switch.md`. Full checklist:
`design/RELEASE-CHECKLIST.md`.

## Before the production release (owner actions)

- [ ] Merge this branch to `main` so GitHub Pages serves the updated privacy policy
      (`docs/privacy-policy.html`); the live page still says "no ads".
- [ ] Play Console: Data safety (advertising ID and app interactions via the AdMob SDK;
      purchase history once billing is on), Contains ads: Yes, target audience, content
      rating, privacy policy URL.
- [ ] Replace the store screenshots in `production/screenshots/` — they show the Unity
      build. `CAPTURE=1 npx playwright test e2e/screens.spec.ts` captures every screen.
- [ ] Build and sign: `npm run android:sync`, then Android Studio → Generate Signed
      Bundle with your existing upload key (kept outside the repo). Commit the
      regenerated `android/capacitor.settings.gradle` and
      `android/app/capacitor.build.gradle` that `cap sync` writes.
- [ ] Run the device checklist in `design/TESTING-GUIDE.md`.

## Known limits and deliberate choices

- **Saves are local.** There is no cloud save now that the fake Play Games sync is gone.
  Android Auto Backup (`allowBackup`) may restore data on a new device; uninstalling
  without a backup loses progress. Export/Import in Settings is the manual fallback.
- **No server receipt validation.** Grants rely on the Play Billing client. Refunds are
  not revoked.
- **Tokens can exceed the 5-token cap** when they come from rewards (quests, ads,
  purchases). Regeneration and boss drops never exceed it.
- **A boss fight is held while a minigame is open**, and behind the offline and
  world-unlock dialogs: the timer stops and auto-attack skips the boss, so it is
  never won or lost off-screen. Ordinary enemies keep being farmed.
- **Not built (spec extras):** the forge reveal animation (there is a short beat,
  not the spec's sequence), first-drop banner, pet level-up banners, offline pet XP.

## Where things live

| Path | What |
| --- | --- |
| `src/game/` | The rules (reducer, stats, loot, quests, arcade, offline, tap guard, save) + tests |
| `src/context/GameProvider.tsx` | Tick, autosave, lifecycle, back button, ads/billing start-up |
| `src/hooks/` | `useGameState`, `useDispatch`, `useAdOffer`, `useStore`, back-button stack |
| `src/services/` | AdMob, Play Billing, audio, haptics |
| `src/config/monetization.ts` | Every monetization switch |
| `src/components/` | Screens; `minigames/` holds the host, contract and the seven games; `ui/` the primitives |
| `src/data/definitions.ts` | All content: enemies, upgrades, gear, relics, pets, skills, minigames, quests, products, ads |
| `e2e/` | Playwright tests (`PW_CHROMIUM=/path/to/chrome` to use a pre-installed browser) |
| `design/`, `production/` | Specs, checklists, store listing, monetization runbook |
