# Release checklist — Vanta Eclipse

Everything between today's build and a production release on Google Play:
what is missing, how to switch on ads and billing, how to build and sign,
and what to test on a phone. The paste-ready Play Console answers, store
listing and release notes are in `production/play-console.md`.

`[x]` is true in the repository today. `[ ]` is not done yet, or can only be
done in a Google console or on a phone.

**Snapshot: 1.4.0 (versionCode 5), October 2026.** The game is feature
complete for its first release. Typecheck, the unit tests, the end-to-end
suite and the production build all pass, and CI runs them on every push
(`.github/workflows/ci.yml`). It has never been run on a phone in this
version, it serves Google's sample ads, and it sells nothing.

---

## What is missing for production

### Blockers (owner actions)

1. **Real AdMob IDs**, app-ads.txt and the consent messages ([Monetization](#monetization)).
2. **Billing products** in Play Console, license-tested, then `BILLING_ENABLED`.
   Launching with ads only is also fine: leave the switch off.
3. **A signed bundle** made with the existing upload key ([Build and sign](#build-and-sign)).
4. **The device checklist** on a real phone ([Device checklist](#device-checklist)).
   Nothing in 1.4.0 has run on Android hardware yet.
5. **Play Console App content**: every answer is drafted in
   `production/play-console.md`; the ones marked "Owner's call" need a decision.
6. **Closed-testing gate.** A personal developer account created after
   2023-11-13 needs 12 testers opted in for 14 continuous days before it can
   apply for production. It is a calendar gate, so start it first.

### Gaps in the game (not blockers)

These are what a long-lived release would normally have. None stops a launch.

| Gap | Why it matters | Smallest fix |
| --- | --- | --- |
| **Two worlds of content.** Levels 51 and up are the Frozen Ruins forever, with 16 enemies in all. The roadmap in `design/game-design.md` names three more worlds. | Retention after the first few Eclipses. | Worlds are data: a new entry in `WORLDS` and `ENEMIES` in `src/data/definitions.ts` plus sprites. |
| **No crash or error reporting.** JavaScript errors inside the WebView never reach Play's Android vitals. | You are blind to bugs players hit. | A crash reporter (it changes the Data safety form and the privacy policy), or at minimum watch Android vitals for ANRs. |
| **No cloud save.** The save is local; Android Auto Backup may restore it, and Export/Import in Settings is manual. | A lost or replaced phone can lose all progress. | Play Games Services Saved Games. |
| **No server-side receipt validation; refunds are not revoked.** | A rooted device can edit its entitlements; a refunded Remove Ads stays. Acceptable for three cheap products. | A backend holding a Play service-account key. |
| **Unbounded gear storage.** Drops pile up in ARMOR until salvaged. | Very long sessions make the list long and the save larger. | A storage cap with auto-salvage of the oldest Commons. |
| **English only.** Every string is inline. | Limits the markets the listing reaches. | Extract strings before translating. |
| **Uncompressed audio.** The music track is a 1 MB WAV and the effects another 0.7 MB. | Download size. | Re-encode to OGG and change the two paths in `src/services/audio.ts`. |
| **No in-game Reduce Motion or text-size setting.** The OS reduced-motion setting turns off the enemy and shake animations. | Accessibility beyond the committed tier. | See `design/game-design.md`. |
| **The device clock is trusted.** Setting it back grants nothing; setting it forward pays up to the offline and token caps. | Minor cheating in a single-player game. | Needs a server; not worth it now. |

---

## Build and sign

- [x] **Identity.** Package `com.vantrexagames.vantaeclipse` in
      `android/app/build.gradle` and `capacitor.config.ts`. Permanent once
      published.
- [x] **SDK levels** in `android/variables.gradle`: minSdk 24, compileSdk 36,
      targetSdk 36. Play raises the minimum target every August.
- [x] **Version.** versionName 1.4.0 and versionCode 5 in
      `android/app/build.gradle`, and 1.4.0 in `package.json` (the game shows
      that one in Settings). Change them together.
- [x] **Secrets cannot be committed.** `.gitignore` blocks keystores,
      key.properties, google-services.json, service-account JSON and built
      bundles. The web bundle that `npx cap sync` copies into the Android
      project is generated and untracked.
- [x] **Launcher icon and splash** are the game's crescent on #080A12, with a
      monochrome layer for Android 13+ themed icons.
- [x] **The project builds from the command line** (`./gradlew assembleDebug
      bundleRelease lintDebug`, last checked 2026-10-06, no lint errors). See
      "Command-line build" in `README.md`.
- [ ] **Bump versionCode for every upload**, closed testing included. Play
      rejects a versionCode it has seen.
- [ ] **Build the bundle:** `npm run android:sync`, then `npx cap open android`
      and Build → Generate Signed App Bundle with the **existing upload
      keystore** (the one the closed-testing uploads used). Keep it and its
      passwords outside the repo, backed up. If `cap sync` changes
      `android/capacitor.settings.gradle` or `android/app/capacitor.build.gradle`,
      commit them.
- [ ] **Check the bundle** in Play Console's App bundle explorer: the
      versionCode, no 16 KB page-size warning (there are no native libraries),
      and exactly these 11 permissions (2026-10-06 build):
      - INTERNET and ACCESS_NETWORK_STATE (the app and AdMob);
      - com.google.android.gms.permission.AD_ID and ACCESS_ADSERVICES_AD_ID,
        ACCESS_ADSERVICES_ATTRIBUTION, ACCESS_ADSERVICES_TOPICS (play-services-ads);
      - WAKE_LOCK and FOREGROUND_SERVICE (WorkManager, pulled in by AdMob; no
        foreground service type is declared);
      - com.android.vending.BILLING (Play Billing, present even while billing is off);
      - VIBRATE (@capacitor/haptics);
      - com.vantrexagames.vantaeclipse.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
        (androidx.core, signature-level).

      RECEIVE_BOOT_COMPLETED must not appear. The AdMob plugin takes
      play-services-ads 25.4.+, so compare the list on every release and
      update the privacy policy if it changes.

---

## Monetization

Today the build serves Google's **sample** ads and sells nothing. Going live
means changing values in two files and configuring two Google consoles.
Every video is opt-in, never interstitial, and a bonus on top of something
already earned.

### The switches

| Switch | File | Today | Effect |
| --- | --- | --- | --- |
| AdMob App ID | `android/app/src/main/AndroidManifest.xml`, `com.google.android.gms.ads.APPLICATION_ID` | sample `ca-app-pub-3940256099942544~3347511713` | Identifies the app to the Ads SDK. Must be the App ID (with `~`) of the AdMob app that owns both units below. |
| `ADMOB.bannerAdUnitId` | `src/config/monetization.ts` | sample | The adaptive bottom banner. |
| `ADMOB.rewardedAdUnitId` | `src/config/monetization.ts` | sample | One unit shared by all three rewarded offers. |
| `ADMOB.isTesting` | `src/config/monetization.ts` | `true` | While true, the plugin swaps any unit ID for Google's sample, so real IDs still earn nothing. Set false for the production build only. |
| `BILLING_ENABLED` | `src/config/monetization.ts` | `false` | While false, Play is never contacted and paid items read COMING SOON. While true, the three products load at Play's localised prices and owned ones are re-granted. |

Placements, caps and product contents are data in `src/data/definitions.ts`:

| Placement | Where | Reward | Daily cap |
| --- | --- | --- | --- |
| `offline_double` | Welcome-back dialog | doubles the offline essence | 3 |
| `arcade_token` | Arcade, when out of tokens | +1 token | 3 |
| `essence_boost` | BAZAAR | 600 s of essence at the current rate | 5 |

| Product | Play ID | Type | Contents |
| --- | --- | --- | --- |
| Remove Ads | `vanta_remove_ads` | non-consumable | no banner; offers become instant (caps stay) |
| Starter Pack | `vanta_starter_pack` | non-consumable | 25 Void Crystals, 5 tokens, the Ember Trail |
| Astral Shards Pouch | `vanta_shards_small` | consumable | 200 Astral Shards |

A watch is counted after its reward, so a watch that pays nothing never uses
up an offer. A purchase is granted once per Play transaction and saved before
it is acknowledged or consumed; `syncPurchases()` in
`src/hooks/useMonetization.ts` re-checks Play at launch and on resume, which
also restores entitlements after a reinstall.

### AdMob console

- [ ] Create the Android app, one **Banner** unit and one **Rewarded** unit
      (the game ignores the unit's reward amount).
- [ ] Privacy & messaging: publish a **European regulations (GDPR)** message
      and a **US state regulations** message. The app shows Google's form
      only where UMP says it is required.
- [ ] Blocking controls → **maximum ad content rating**: match the lowest
      rating Play issues (G for Everyone / PEGI 3, PG for E10+ / PEGI 7). The
      code sets none.
- [ ] **app-ads.txt** at the root of the host named as "Website" in the Play
      listing. It cannot live in this repo: GitHub Pages serves `docs/` under
      /Vanta-Eclipse/ and AdMob only checks the host root. Use a user-site
      repository named kidriqrif.github.io, your own domain, or Firebase Hosting.
- [ ] Settings → Test devices: register every phone you will test on.
- [ ] Once the listing is public, link the AdMob app to it; serving is
      limited until it is linked and reviewed.

### Ads in code

- [ ] Put the real App ID in the manifest and the two unit IDs in
      `src/config/monetization.ts`, all three together. Keep `isTesting: true`,
      build, and confirm you still see labelled test ads.
- [ ] For the production build only, set `isTesting: false` and install it on
      a **registered** test device. Ads must still carry a test label. If one
      does not, the device is not registered: do not tap it.

### Play Console billing

- [ ] Set up a payments profile (merchant account).
- [ ] Have a bundle from this codebase on the closed track (it carries the
      BILLING permission, which Play may require before products can be made).
- [ ] Monetize → one-time products: create `vanta_remove_ads`,
      `vanta_starter_pack` and `vanta_shards_small` with exactly those IDs
      (they are `storeId` in `src/data/definitions.ts` and can never be
      reused). Play has no consumable switch; the app consumes shard packs.
- [ ] Settings → License testing: add the tester accounts. Each must be opted
      in to the closed track and install **from Play**.
- [ ] Set `BILLING_ENABLED = true`, bump versionCode, upload to closed testing.
      **That build charges real money** to any tester who is not a license
      tester.

### Never

- Click your own live ads, or let testers do it. AdMob treats it as invalid
  traffic and can close the account.
- Ship real IDs with `isTesting: true` (test ads for everyone, no revenue), or
  mix sample and real IDs.
- Rename or recreate a product. Play IDs are permanent.
- Add interstitials or forced ads. The privacy policy and the listing promise
  every video is optional.
- Test monetization in a browser. `npm run dev` only simulates a rewarded
  watch; the web build has no ad network.

---

## Play Console

Answers, with sources, are in `production/play-console.md`.

- [ ] **Privacy policy URL:** https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html
      (published from `docs/privacy-policy.html` on `main`; bump its date when
      it changes).
- [ ] **Ads:** Yes. **Advertising ID:** Yes (advertising, analytics, fraud prevention).
- [ ] **Data safety:** from Google's AdMob disclosure: device or other IDs,
      app interactions, diagnostics, approximate location. Add purchase
      history once billing is on.
- [ ] **Target audience:** 13 and over. Under-13 groups bring in the Families
      policy, which this build does not meet.
- [ ] **Content rating** (IARC): stylised pixel-art combat. Retake it when
      purchases go on.
- [ ] **Sign-in details** (no login) and the news, financial, health and
      government declarations (all No).
- [ ] **Store listing:** paste the copy from `production/play-console.md` and
      upload the assets below.

### Store assets

- [x] Icon 512×512, no alpha: `production/icons/store_icon_512.png`.
- [x] Feature graphic 1024×500, no alpha: `production/icons/feature_graphic_1024x500.png`.
- [x] Eight 1080×1920 phone screenshots of the current build in
      `production/screenshots/`, in upload order. After a UI change:
      `CAPTURE=1 npx playwright test e2e/store-shots.spec.ts`. They come from
      the web build, so they show no banner.
- [ ] Compare the store icon with the launcher icon on a device.

---

## Testing

### Automated

| Command | What it proves |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit`, strict. |
| `npm test` | Vitest: the reducer, tap guard, save migration and number formatting, with a fixed clock and a seeded RNG. |
| `npm run e2e` | Playwright on a Pixel 7 viewport against the dev server: the core loop and every tab, boss retreat and challenge, the autoclicker lockout, v1 save migration and the offline double, billing off, ad caps, all seven minigames paying exactly once, a boss held behind a minigame, and a second tab taking over the save. |
| `npm run build` | The production web bundle. |

CI runs all four on every push and pull request. Locally, set `PW_CHROMIUM`
to use an installed Chrome instead of `npx playwright install chromium`.

### Device checklist

Run it on a debug build (`npm run android:sync`, then `npx cap run android`),
then again on the build **installed from the closed track**: that is the first
time the app runs re-signed and split the way Play delivers it. A debug
build's WebView can be inspected at chrome://inspect.

**Ads and consent.** Every ad carries a "Test Ad" label. The banner appears
after the consent check. To see the consent form outside the EEA/UK, pass
`debugGeography` and your hashed device ID (printed in logcat) to
`requestConsentInfo` in `src/services/ads.ts`, and do not commit it. Check
that the form comes before any ad, that refusing leaves the game fully
playable, and that Settings shows AD PRIVACY OPTIONS where consent applies.

**Rewarded offers**, for each of the three: watching to the end grants once
and lowers the count; closing early grants nothing and costs nothing; in
airplane mode the offer fails cleanly; at the cap it is disabled.

**Purchases** (license tester, billing on): each product shows Play's price;
each grants once and a cancel grants nothing; Remove Ads hides the banner and
makes offers instant with the caps unchanged; the Starter Pack cannot be
bought twice; the Shards Pouch can; clearing data restores Remove Ads and the
Starter Pack on launch, and RESTORE PURCHASES does it on demand; a pending
payment ("slow" test card) grants nothing until it clears, then arrives on the
next resume and shows as acknowledged; buying an owned item on a second device
restores it.

**The banner never covers the game.** Every tab, the MORE sheet and the nav
bar sit fully above it with a visible gap; no dialog, minigame or toast has a
control under it; it sits above both gesture and three-button navigation; in
airplane mode the strip collapses and the banner returns within minutes of
reconnecting.

**Back button**, in this order: closes the open dialog; arms then forfeits a
running minigame (a held boss resumes); goes from any tab to UPGRADES;
minimizes the app from UPGRADES. It never kills the app.

**Lifecycle.** Music and sound stop in the background and resume on return
(no sound before the first tap on a cold start is expected). After a
force-stop, level, essence and gear are as they were a few seconds earlier;
try it straight after an Eclipse too. Offline earnings (after run level 15):
press home for 2+ minutes, or force-stop and relaunch, and the Welcome-back
dialog shows an amount already in the total, about 50% of the idle rate
capped at 8 h; doubling works once. The token meter refills one per 30
minutes while closed.

**Haptics.** With Vibration on: manual crits (light), a boss starting
(medium), a boss dying and the Eclipse (heavy), Epic or better drops. With it
off, nothing vibrates.

**Autoclicker.** Point an autoclicker app at the enemy at about 100 ms: manual
taps lock within seconds for 10 s, then 30 s, then 60 s; auto-attack keeps
hitting; locked taps do not count toward quests; no ad ever appears; after 5
clean minutes the next lockout is 10 s again. Two-thumb mashing for 30 s must
never lock (thresholds in `src/game/tapGuard.ts`).

**Screen.** It stays portrait with auto-rotate on (Android 16 exempts games
from forced landscape on large screens, and the manifest declares
`appCategory="game"`; check once on a tablet or foldable). On an Android 15+
phone with a camera cutout, nothing sits under the status bar, cutout or
gesture handle. Text is legible at arm's length and taps land where they look.

**One long session from a fresh save:** reach level 15 and see auto-attack
unlock; lose a boss on the timer, farm, CHALLENGE BOSS and win; equip, salvage
and forge; play every unlocked minigame to a win and a loss; beat the level-50
world boss and receive Ember; Eclipse and spend crystals. Over ten minutes the
phone should not get hot.

**Save upgrade.** Install the previous closed-testing build, play, then update
to this one. Progress survives the v1 → v2 migration in `src/game/save.ts`. A
Remove Ads or Starter Pack the AI Studio build granted without payment is
removed (its contents stay); say so in the release notes.

### Where the save lives on a device

WebView localStorage for the origin https://localhost, inside the app's
private data. On a debug build, chrome://inspect → Application → Local Storage
shows it; on any build, EXPORT SAVE in Settings copies it, which is how to get
a tester's save for a bug report.

| Key | What |
| --- | --- |
| vanta_eclipse_save_v1 | the save (JSON with `version: 2` inside) |
| vanta_eclipse_save_backup | the last save that loaded cleanly |
| vanta_eclipse_save_v1_premigration | a one-time copy of an old v1 save |

A reset must remove the save and the backup, or the backup comes back; Settings
→ RESET does both. To test Auto Backup:
`adb shell bmgr backupnow com.vantrexagames.vantaeclipse`, then reinstall.
