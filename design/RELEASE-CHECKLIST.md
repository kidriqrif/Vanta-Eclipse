# Vanta Eclipse — Release Checklist

What has to be true before this build goes from **closed testing to production**
on Google Play. `design/TESTING-GUIDE.md` covers what has to be *proven*, and
`production/monetisation-switch.md` is the step-by-step runbook for turning on ads
and billing.

`[x]` means it is true in the repository today. `[ ]` means it is not done yet,
or it can only be done in a Google console or on a phone.

The Unity-era version of this checklist, with its build script, keystore notes
and stubbed monetisation, is in git history. None of it applies to this build.

---

## Build and signing

- [x] **Identity.** Package `com.vantrexagames.vantaeclipse` in
      `android/app/build.gradle` and `capacitor.config.ts`. It is permanent
      once the app is published.
- [x] **SDK levels** in `android/variables.gradle`: minSdk 24, compileSdk 36,
      targetSdk 36. Play raises the minimum target level every August, so
      check it again before each release after that.
- [x] **Version.** versionName `1.4.0`, versionCode `5` in
      `android/app/build.gradle`, with `package.json` at `1.4.0`. The game
      reads its displayed version from `package.json` (injected by Vite), so
      change both together.
- [x] **Secrets cannot be committed by accident.** `.gitignore` blocks
      keystores (.jks, .keystore), key.properties, google-services.json,
      service-account JSON files and built .aab/.apk files. The web bundle
      that cap sync copies into the Android project is generated and is
      gitignored too.
- [x] **Launcher icon and splash are the game's own.** The mipmaps and splash
      images under `android/app/src/main/res/` were regenerated in 1.4.0 from
      the crescent art in `public/icons/`, on the game's #080A12 background
      (the adaptive icon background colour too). The adaptive icon also has a
      monochrome layer (a crescent silhouette, `ic_launcher_monochrome.png`)
      for Android 13+ themed icons. Check them on a device: round, squircle
      and themed-icon launchers crop differently.
- [ ] **Bump versionCode for every upload**, including closed-testing ones.
      Play rejects a versionCode it has already seen.
- [x] **The project builds from the command line** (checked 2026-10-06 on
      this commit's code: `./gradlew assembleDebug bundleRelease lintDebug`,
      with lint reporting no errors). See "Command-line build" in `README.md`.
      That proves the Gradle setup, not the app on a phone.
- [ ] **Build the bundle:**

      ```
      npm run android:sync      # tsc + vite build, then npx cap sync android
      npx cap open android
      ```

      In Android Studio choose Build → Generate Signed App Bundle / APK →
      Android App Bundle, then the **existing upload keystore**: the one the
      closed-testing uploads were signed with. Keep it, and its passwords,
      outside the repository and backed up somewhere you control. Play App
      Signing holds the real app-signing key, and a lost upload key can be
      reset from Play Console's app-signing page, but that takes time, so
      don't count on it.
- [ ] In Play Console's App bundle explorer, check the new bundle: the
      versionCode, no 16 KB page-size warning (required for apps targeting
      Android 15+; the app has no native libraries, so this cannot fail
      today), and exactly these 11 permissions, as found in the 2026-10-06
      build:
      - INTERNET (the app's own manifest, and AdMob) and ACCESS_NETWORK_STATE
        (AdMob);
      - com.google.android.gms.permission.AD_ID and the three Privacy Sandbox
        permissions ACCESS_ADSERVICES_AD_ID, ACCESS_ADSERVICES_ATTRIBUTION and
        ACCESS_ADSERVICES_TOPICS (play-services-ads);
      - WAKE_LOCK and FOREGROUND_SERVICE (WorkManager and the measurement API,
        both pulled in by AdMob; no foreground service type is declared, so
        Play's foreground-service declaration should not be triggered);
      - com.android.vending.BILLING (Play Billing);
      - VIBRATE (@capacitor/haptics);
      - com.vantrexagames.vantaeclipse.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION
        (androidx.core; signature-level, held only by the app itself).

      RECEIVE_BOOT_COMPLETED must not be there (the AdMob SDK removes it).
      The plugin asks for play-services-ads 25.4.+, so a later build can pick
      up a newer SDK: compare this list on every release, and update the
      privacy policy if it changes. The Capacitor plugin list
      (`android/capacitor.settings.gradle`,
      `android/app/capacitor.build.gradle`) already includes all four plugins
      (AdMob, App, Haptics and @capgo/native-purchases), so the billing
      library ships even while billing is switched off. `npm run android:sync`
      regenerates those files; commit them if they change.

## Monetization go-live

The details and the test procedure are in `production/monetisation-switch.md`.
Today the build serves Google's **sample** ads and sells nothing.

- [x] AdMob is integrated: an adaptive banner (hidden by Remove Ads) and opt-in
      rewarded offers, initialised in `src/services/ads.ts` after the UMP
      consent check. No interstitials.
- [x] Play Billing is integrated in `src/services/billing.ts` behind
      `BILLING_ENABLED`. Prices come from Google Play; none are hard-coded.
- [ ] Create the AdMob app (Android) plus one **banner** unit and one
      **rewarded** unit. All three rewarded placements share that one rewarded
      unit.
- [ ] Put the real AdMob **App ID** in `android/app/src/main/AndroidManifest.xml`
      (`com.google.android.gms.ads.APPLICATION_ID`, currently the sample
      `ca-app-pub-3940256099942544~3347511713`).
- [ ] Put the real unit IDs in `src/config/monetization.ts`
      (`ADMOB.bannerAdUnitId`, `ADMOB.rewardedAdUnitId`).
- [ ] Set `ADMOB.isTesting` to `false` in the same file, for the production
      build only, and only once the real IDs are in.
- [ ] Publish **app-ads.txt** at the root of the developer website named in the
      Play listing, then check its status in AdMob → Apps → app-ads.txt. It
      cannot live in this repo: GitHub Pages serves it under /Vanta-Eclipse/,
      and AdMob only looks at the host root (see
      `production/monetisation-switch.md`).
- [ ] Set the **maximum ad content rating** in AdMob (Blocking controls) to
      match the lowest content rating Play issues: G for 3+ / Everyone /
      PEGI 3, PG for 7+ / E10+ / PEGI 7. The code sets none, so the account
      default applies.
- [ ] In AdMob → Privacy & messaging, create and publish the **European
      regulations (GDPR)** message and the **US state regulations** message.
      The app shows Google's consent form only when UMP says one is required.
- [ ] Set up a Play Console payments profile, which is needed before you can
      sell anything.
- [ ] Create the one-time products in Play Console with exactly these IDs
      (they must match `storeId` in `src/data/definitions.ts`, and an ID
      can never be reused):
      `vanta_remove_ads` and `vanta_starter_pack` (non-consumable), and
      `vanta_shards_small` (consumable). Play Console has no consumable
      setting; the app consumes the product when it is bought. You can create
      and license-test the products on the **closed testing track** before
      production.
- [ ] Add license testers, test every purchase, then set `BILLING_ENABLED` to
      `true` in `src/config/monetization.ts`. Until then the three products
      show "COMING SOON".

## Play Console declarations

The question-by-question answers (Data safety, content rating, target
audience, advertising ID and the rest), with their sources, are in
`production/play-console.md`. The items below are the checklist.

- [ ] **Privacy policy URL**:
      https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html. Paste it
      into Play Console. The live page is the current version (last updated
      2026-10-06): it describes AdMob, the banner, rewarded videos, Play
      Billing, the permissions and Android backup. GitHub Pages publishes
      `docs/privacy-policy.html` from `main`; keep the in-app copy at
      `public/privacy-policy.html` identical, and bump the date when either
      changes.
- [ ] **Ads**: Contains ads, **Yes**. Every build from this codebase includes
      AdMob.
- [ ] **Advertising ID**: Yes. The AdMob SDK adds the AD_ID permission. Its
      purposes are advertising or marketing, analytics, and fraud prevention,
      matching the Data safety answers.
- [ ] **Data safety.** Fill this in from Google's own AdMob SDK disclosure
      (https://developers.google.com/admob/android/privacy/play-data-disclosure)
      rather than from this list. Expect: **Device or other IDs** (the
      advertising ID and app set ID), **App interactions** and **Diagnostics**, all collected
      by the AdMob SDK for advertising, analytics and fraud prevention, plus
      **approximate location** from the IP address, which the privacy policy
      already states. Once billing is on, also declare **Purchase history**.
      The game itself sends nothing: progress is a local save with no account
      and no cloud copy.
- [ ] **In-app purchases**: Yes, once `BILLING_ENABLED` is true and the
      products are active.
- [ ] **Target audience**: 13 and over. The privacy policy says the app is not
      directed at children under 13. If under-13 age groups are selected, the
      Families policy applies: Families-certified ad SDKs only, child-directed
      ad requests (not set anywhere in `src/services/ads.ts` today), and a
      rewritten privacy policy.
- [ ] **Content rating** (IARC questionnaire). Answer it from what is on
      screen: tap combat with health bars against stylised pixel-art
      creatures. Answer it again once purchases go on, because it asks about
      digital purchases.
- [ ] Sign-in details, formerly App access (no login, nothing gated), plus
      the news, financial, health and government declarations (all No).
- [ ] **Production access.** A personal developer account created after
      2023-11-13 needs at least 12 testers opted in to closed testing for 14
      continuous days before it can apply for production in the Dashboard.

## Testing

- [ ] `npm test` passes on the release commit: the Vitest suites in
      `src/game/__tests__/` covering the reducer, tap guard and save
      migration.
- [ ] `npm run e2e` passes. It runs the Playwright smoke tests against the
      dev server, as configured in `playwright.config.ts`. To use a browser
      that is already installed instead of `npx playwright install`:

      ```
      PW_CHROMIUM=/path/to/chrome npm run e2e
      ```
- [ ] Work through the device checklist in `design/TESTING-GUIDE.md` on a
      physical phone, with the app **installed from the closed testing track**
      rather than sideloaded.
- [ ] **Save upgrade.** Install the previous closed-testing build, play for a
      while, then update to this one. Progress must survive the v1 → v2
      migration in `src/game/save.ts`. A Remove Ads or Starter Pack that the AI
      Studio build granted without payment is removed, and what the pack
      contained stays.
- [ ] Do the ads and billing tests in `production/monetisation-switch.md` on
      a registered AdMob test device and with a license-tester account.

## Store assets

Listing copy and field values are in `production/store-listing.md`.

- [x] Store icon, 512×512 with no alpha: `production/icons/store_icon_512.png`.
- [x] Feature graphic, 1024×500 with no alpha:
      `production/icons/feature_graphic_1024x500.png`.
- [x] **Phone screenshots.** Eight 1080×1920 24-bit PNGs (no alpha) of the
      current build in `production/screenshots/`, `01-combat.png` to
      `08-relics.png`, in upload order. Regenerate them with
      `CAPTURE=1 npx playwright test e2e/store-shots.spec.ts` after a UI
      change. They come from the web build, so they show no AdMob banner.
- [ ] Compare the store icon (`production/icons/store_icon_512.png`) with the
      launcher icon on a device. Both are the crescent now; Play shows them
      side by side, so they should read as the same mark.
- [ ] Paste the listing copy and check the Play preview against the build
      testers actually installed.
