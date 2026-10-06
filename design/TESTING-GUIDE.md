# Testing Guide — Vanta Eclipse

What has to be **proven**, in order, before a build goes to Google Play.
`design/RELEASE-CHECKLIST.md` lists what has to *exist*;
`production/monetisation-switch.md` has the full ads and billing procedure.
Work top to bottom. A later step never stands in for an earlier one, and
nothing in steps 1–4 stands in for a phone.

**Where things stand:** the unit tests (step 2) and the end-to-end suite
(step 3) pass on this branch. The device checklist (step 6) has to be done again for 1.4.0, because the game
core and every screen changed after the last closed-testing build.

The Unity-era guide (the **tools/validate_all.sh** sweep, headless
**tools/screenshots.sh** captures, **tools/build_android.sh**) is in git
history. None of it applies to this build.

---

## 1. Types

```
npm run typecheck
```

`tsc --noEmit` over the whole project. `npm run lint` is the same command;
there is no ESLint. This is a gate, not a check of behaviour.

## 2. Unit tests

```
npm test
```

Vitest in Node, no browser. The tests are in `src/game/__tests__/`:

| File | Covers |
|---|---|
| `src/game/__tests__/reducer.test.ts` | combat and boss gates, spending, gear, pets, the Eclipse, the arcade latch and payout, token regen, quests, ad caps, purchases, offline |
| `src/game/__tests__/save.test.ts` | v1 → v2 migration, backup fallback, corrupt saves, round-trips |
| `src/game/__tests__/tapGuard.test.ts` | the autoclicker signals, lockout escalation, forgiveness |

`src/game/__tests__/helpers.ts` gives a fixed clock you can advance and a
seeded RNG, so every rule is tested deterministically. A change to a rule in
`src/game/` gets a test here.

## 3. End-to-end in a browser

```
npm run e2e
PW_CHROMIUM=/path/to/chrome npm run e2e     # use an installed browser
```

Playwright, configured in `playwright.config.ts`: a Pixel 7 portrait profile
against the Vite dev server on port 5173, which it starts or reuses. The tests
drive the real UI and read or patch state through the dev-only `window.__vanta`
handle that `src/context/GameProvider.tsx` sets.

- `e2e/smoke.spec.ts`: a new game taps, earns and climbs, and every tab
  opens without a console error; boss gate retreat and challenge; a metronome
  autoclicker is locked out while human-paced tapping is not; a v1 save
  migrates and its offline reward can be doubled once; paid items grant
  nothing while billing is off; an ad offer stops at its daily cap; a second
  browser tab takes over the save and the first stops writing.
- `e2e/arcade.spec.ts`: every minigame plays to an outcome and pays exactly
  once; an open minigame holds a boss fight (no damage, no timer drain);
  quitting forfeits the token and pays nothing.
- `e2e/screens.spec.ts`: skipped unless `CAPTURE=1`; then it saves a
  screenshot of every screen, for the store listing and for eyeballing
  layout.

The dev build fakes a rewarded watch (about a second, then "rewarded"), which
is why ad flows can run here at all. It proves the game's side of the flow and
nothing about AdMob.

## 4. Production build

```
npm run build       # tsc, then vite build into dist/
npm run preview     # serves that build on port 3000
```

Open the preview once, on a phone browser if you can. This is the web build
as shipped: there is no `window.__vanta`, rewarded offers are unavailable
(there is no ad network on the web), and the service worker in `public/sw.js`
registers. Check that it loads, that the fonts look right (they are bundled
through @fontsource, so a blank or fallback face means a broken build), and
that it plays.

## 5. Android build on a device

You need Android Studio and JDK 21 (see `README.md`).

```
npm run android:sync          # npm run build, then npx cap sync android
npx cap run android           # build and install on a connected device
```

Or `npx cap open android` and Run from Android Studio. The sync copies
the web bundle into the Android assets folder, which is generated and
untracked, so run it before every Android build or the phone gets an old
bundle.

A debug build's WebView can be inspected. With the phone on USB debugging,
open chrome://inspect on the computer and choose the Vanta Eclipse WebView.
You get the console, the network panel and storage. A release build, including
one installed from Play, cannot be inspected.

## 6. The device checklist

On a physical phone. Do it once on a debug build, then again on the build
installed from the closed testing track (step 7).

**Ads (test ads and consent).** The build carries Google's sample ad IDs and
`isTesting: true` (`src/config/monetization.ts`), so every ad must carry a
"Test Ad" label. A banner appears at the bottom after the consent check.
The consent form only appears where UMP says it is legally required, and
`src/services/ads.ts` passes no debug geography. To see it from outside the
EEA/UK, temporarily pass `debugGeography` (EEA) and your device's hashed ID in
`testDeviceIdentifiers` to the `requestConsentInfo` call. The UMP SDK prints
the hashed ID to logcat. Do not commit the change. Then check:

- the form appears before any ad loads;
- refusing consent leaves the game fully playable;
- Settings shows the ad privacy options entry when consent applies, and it
  reopens the form.

Once answered, the form does not come back on its own. Clear the app's storage
to see it again, which also deletes the save, so export the save from Settings
first.

**Rewarded offers grant only after the video.** There are three placements,
each with a daily cap from `ADS` in `src/data/definitions.ts`: double offline
reward (in the offline-rewards modal only, 3 a day), a bonus Arcade token (in
the Arcade when out of tokens, 3 a day), and Essence Surge (in the BAZAAR, 5 a
day). For each placement:

- Watch to the end: the reward lands once and the remaining count drops by one.
- Close the video early: nothing is granted and the count does not drop. A
  watch is counted after the grant.
- In airplane mode: the offer fails cleanly, grants nothing and does not spin
  forever.

**The banner never covers the game.** The banner is a native view drawn over
the WebView. The app reserves a strip of its height at the bottom of the
layout. Check:

- every tab, the MORE sheet and the bottom navigation bar are fully tappable
  above it, with a visible gap (12 px) between the banner and the nav, so a
  thumb aimed at a tab does not land on the ad;
- the bottom edge of every modal, of the minigame screen and of toasts is
  clear of it: no overlay (Settings, offline rewards, world unlock, a
  minigame's result banner) has buttons under the banner;
- the banner sits above the system navigation bar with both gesture
  navigation and three-button navigation;
- in airplane mode the strip collapses (no empty band), and the banner comes
  back on its own within a few minutes of reconnecting.

**Back button.** Handlers stack in `src/hooks/useBackHandler.ts`, and the most
recent one wins. Back should do the following, in this order:

1. close the open modal;
2. leave a minigame (a run in progress is forfeited like QUIT, per
   `design/ux/milestone-9-minigame-framework.md`, and a held boss fight
   resumes);
3. from any other tab, go to the home tab (the upgrades, labelled UPGRADES);
4. from the home tab, minimize the app (`src/context/GameProvider.tsx`).

Back must never kill the app. Reopen it from recents and it should be exactly
where you left it.

**Music pauses in the background.** Press home, switch apps or turn the
screen off: music and sound stop. Come back: music resumes. On a cold start
there is no sound until the first tap. That is expected, because Web Audio
cannot start before a user gesture.

**Haptics toggle.** With haptics on in Settings, these vibrate: a manual
critical hit (light), a boss fight starting (medium), a boss dying and the
Eclipse (heavy), and Epic or better drops. With haptics off, none of them do.
If nothing vibrates with the setting on, check the phone's own vibration
settings before calling it a bug.

**Offline reward.** Offline earnings need auto-attack, so first reach run
level 15 (or own Eternal Reflex). On a save below that, getting no reward is
correct. Then:

- Press home, wait at least 2 minutes and come back. The offline modal shows
  what was earned, and that amount is already in the essence total. Resuming
  pays only after 60 s or more away.
- Force-close: swipe the app out of recents, or run
  `adb shell am force-stop com.vantrexagames.vantaeclipse`. Wait at least 2
  minutes and relaunch. The modal should appear on load.
- The amount should be close to 50% of the idle rate × the time away, capped
  at 8 hours. Long Slumber, Deep Rest and an attuned Eclipse Heart raise it
  (`src/game/offline.ts`).
- Doubling works once. The modal closes with one tap.
- After 30 minutes or more away, the Arcade token meter (if it was not full)
  has refilled by one per 30 minutes, up to 5.

**The save survives a force-close.** Play for a while, then leave the game
alone for about 10 seconds. It autosaves every 5 s when something changed, and
immediately on background, an Eclipse, a world unlock, an arcade start or
result, an ad reward and a purchase. Then force-stop and relaunch: level,
essence and gear are as you left them. `am force-stop` sends the app no pause event, so up to the last
few seconds of play can be lost. Anything more is a bug. Also try a force-stop
straight after an Eclipse. Whether that write reaches disk in time is a real
question for the WebView, not a formality.

**Portrait lock.** With auto-rotate on, turn the phone: the game stays
portrait (`android:screenOrientation` in
`android/app/src/main/AndroidManifest.xml`). See the landscape note at the
end for large screens.

**Notch and safe areas.** Test on a phone with a camera cutout running
Android 15 or later, where edge-to-edge is enforced. The header must not sit
under the status bar or cutout, and the navigation bar and banner must not sit
under the gesture handle. The layout pads itself with the safe-area insets
(`src/App.tsx`, with `viewport-fit=cover` in `index.html`). If you can, repeat
on an Android 14 or older phone, because older WebViews report insets
differently.

**Autoclicker lockout.** Install any autoclicker app from Play, point it at
the enemy and set an interval of about 100 ms. Within a few seconds manual
taps lock, and the arena says tapping is paused. Check:

- the lockout lasts 10 s, then 30 s on the next strike, then 60 s;
- auto-attack keeps hitting during a lockout;
- taps made while locked do not count toward quests;
- no ad appears at any point;
- after 5 clean minutes the next lockout is back to 10 s.

Then tap as fast as you can with two thumbs for 30 seconds: no lockout.

The thresholds are in `src/game/tapGuard.ts`: 25 taps in 1 s, 50 in 3 s, 20
near-identical intervals at 4 or more taps a second, or 20 touch taps within
1.5 px. A bot slower than about 4 taps a second is not caught by any
signal.

**General.**

- It launches straight onto the combat screen.
- Every tab and the MORE sheet open and come back.
- Text is legible at arm's length on a real panel, and taps land where they
  look like they land (`design/accessibility-requirements.md`).
- Sound does not clip or pop on the phone speaker.
- Over a ten-minute session the phone does not get hot, and battery drain is
  unremarkable.

**One long session** from a fresh save (Settings → reset, or clear storage):

- reach level 15 and see auto-attack unlock;
- lose a boss on the timer, RETREAT, farm, CHALLENGE BOSS and win;
- equip, salvage and forge gear (ARMOR tab);
- unlock the Arcade at lifetime level 20 and play each unlocked game to a win
  and a loss;
- beat the level-50 world boss, see the Frozen Ruins unlock and receive Ember;
- trigger an Eclipse and spend Void Crystals.

## 7. Installed from Play

Upload the AAB to the internal or closed testing track and install it **from
Play**, not with adb. This is the first time the app runs as Play delivers it:
re-signed with the app-signing key, split by device, installed by the store.
Repeat step 6 on that install. Also check the save upgrade from the previous
closed-testing build, as described in `design/RELEASE-CHECKLIST.md`, and that
the store screenshots match what the phone shows.

A personal developer account created after 2023-11-13 needs 12 testers opted
in for 14 continuous days before it can apply for production. That is a
calendar gate, so book it before choosing a launch date.

---

## Where the save lives on a device

The save is the WebView's `localStorage`, under the origin https://localhost
(Capacitor serves the app from there). It sits inside the app's private data
directory, as LevelDB files under:

```
/data/data/com.vantrexagames.vantaeclipse/app_webview/
```

It is not on shared storage, and a file manager cannot reach it. On a debug
build, inspect it through chrome://inspect → Application → Local Storage →
https://localhost. The keys, from `src/game/save.ts`:

| Key | What |
|---|---|
| vanta_eclipse_save_v1 | the save: JSON with `version: 2` inside (the key name predates the version field) |
| vanta_eclipse_save_backup | the last save that loaded successfully |
| vanta_eclipse_save_v1_premigration | a one-time copy of an old v1 save, taken before its first migration |

On a release build, the export in Settings copies the same JSON to the
clipboard. That is the way to get a tester's save for a bug report.

> **Resetting means removing both the save and the backup.** If only
> vanta_eclipse_save_v1 is deleted, the next launch loads the backup and the
> "reset" comes back. Settings → reset clears both. Android's Clear storage
> clears everything, including the UMP consent answer.

Saves are local only, with no cloud save. Because `android:allowBackup` is
true, Android Auto Backup may restore the app's data on a reinstall or a new
phone. To test it, run `adb shell bmgr backupnow com.vantrexagames.vantaeclipse`,
then uninstall, reinstall and look.

## What has no test yet

- **Localisation.** Every string is inline English.
- **Analytics.** There are none. The economy has never been checked against
  real players.
- **Clock changes.** Offline earnings and token regen use the device clock.
  Setting the clock back grants nothing, but setting it forward pays up to the
  caps. There is no server to check against.
- **Receipts.** There is no server-side receipt validation. Grants rely on the
  Play Billing client.
- **Landscape.** The activity is portrait-locked, but Android 16 ignores that
  on displays 600dp and wider for apps targeting SDK 36. A tablet, an unfolded
  foldable or a large split-screen window can show the game in landscape. The
  layout is a single centred column at most 448 CSS px wide, so it should
  strand rather than break. Android 16 exempts games that declare
  `android:appCategory="game"`, and `android/app/src/main/AndroidManifest.xml`
  declares it, so the portrait lock should hold. Check it once on a tablet
  or an unfolded foldable anyway.
