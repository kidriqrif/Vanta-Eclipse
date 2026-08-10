# Vanta Eclipse — Release Checklist

**What must EXIST before submission.** `TESTING-GUIDE.md` lists what must be
*proven*; start there instead if you want the order of operations.

Everything that can be produced from inside this repository now exists and is
verified against a real artifact rather than asserted. What remains needs a
Google account, a human accepting a licence, or a physical device.

---

## Build and signing — done, and checked on the artifact

- [x] **Toolchain**, all outside the repo, all stated in
      `tools/build_android.sh` so none of it lives in someone's shell history:

      | | |
      |---|---|
      | Unity | 6000.5.7f1 |
      | JDK 17 | `C:/Users/kidri/dev-tools/jdk-17` (Temurin 17.0.13) |
      | Android SDK | `C:/Users/kidri/Android/Sdk` |
      | packages | platform-tools, build-tools 35.0.0 / 36.0.0 / 36.1.0, platforms 35 + 36 |

- [x] **Debug APK** — `bash tools/build_android.sh debug`. Verified rather than
      merely produced: `apksigner` confirms APK Signature Scheme v2, and
      `aapt2 dump badging` reports package `com.kidriqrif.vantaeclipse`,
      versionCode 1, **minSdk 26 / targetSdk 36**, arm64-v8a, exactly one real
      permission (`VIBRATE`), and a **launchable activity**.

      > The launcher-activity check is a hard failure in the script because an
      > APK once shipped without one. `Assets/Plugins/Android/AndroidManifest.xml`
      > REPLACES Unity's `UnityManifest.xml` rather than merging into it, so
      > declaring a permission and an empty `<application>` deleted both Unity
      > activity blocks. It installed and could not be started.

- [x] **Signed release AAB** — `bash tools/build_android.sh release`, 27.6 MB.
      The script compares the bundle's signer fingerprint to the keystore's;
      `jar verified` alone is true of a debug-signed bundle too.

      > Unity 6000.5.7f1 **does not parse** `-keystorePath` / `-keystorePass` /
      > `-keyaliasName` / `-keyaliasPass`; those literals appear nowhere in
      > `Unity.exe`, `UnityEditor.dll` or the Android extension.
      > `BuildAndroid.ApplySigning` reads them, and `ClearSigning` scrubs the
      > fields in a `finally` so an editor exit cannot persist a password into
      > `ProjectSettings.asset`, which is tracked and pushed to a public remote.

- [x] **16 KB page size** — all six `.so` in the bundle carry `PT_LOAD
      p_align = 0x4000`. Read the ELF headers, not the zip entry offsets: an
      entry offset says nothing about the alignment of a compressed library.

- [x] **Upload keystore**, RSA 2048, valid to 2053:
      `C:/Users/kidri/keystores/vanta-eclipse-upload.jks`, alias `upload`,
      password in `vanta-eclipse-upload.password.txt` beside it. Both outside
      the repo. SHA-256:
      `3A:5B:8A:01:C8:37:06:8B:CB:F1:06:B3:2A:45:3B:6C:8D:9E:EE:3A:9B:8D:9C:EA:EB:9C:DB:A0:AB:D2:62:13`

      > **Back this up somewhere you control, today.** Lose it and you cannot
      > ship an update to an app signed with it. Play App Signing can reset an
      > *upload* key on request, which is a strong reason to enrol when you
      > create the app — but do not rely on it.

- [x] **Identity.** `com.kidriqrif.vantaeclipse`, versionName `0.1.0`,
      versionCode `1`. Bump the code on every upload; Play rejects a repeat.

- [ ] **Confirm the package name before the first upload.** It was chosen from
      the GitHub account and is **permanent once published**. If you own a
      domain, use it instead.

- [ ] **Check the target SDK against current policy.** It is 36, which meets
      the requirement as of August 2026. Play raises the floor every August.

## Store assets — done

All generated from the theme's own values, so the listing and the game agree.
`python tools/make_icons.py` rebuilds them.

- [x] Launcher icon 192×192 and both 432×432 adaptive layers. Foreground art
      inside the 264px safe circle; background fully opaque; the occluded disc
      punched to transparent rather than black, so launcher parallax cannot
      reveal a seam.
- [x] 512×512 store icon, alpha stripped — Play rejects an alpha channel even
      when every pixel is opaque.
- [x] Feature graphic 1024×500.
- [x] Listing copy, categorisation and Data Safety notes:
      `production/store-listing.md`.
- [x] **Privacy policy is live and dated** at
      `https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html`, and
      `SettingsMenu` opens that exact URL. Source is `docs/privacy-policy.html`;
      `tools/check_docs.py` keeps it honest.
- [x] **The advertising version of the policy is written and staged** at
      `docs/privacy-policy-ads.html` — full AdMob disclosure, Play Billing, the
      `AD_ID` permission, the opt-out routes and the EEA/UK consent note. It is
      deliberately NOT published: the live page has to describe the app that
      actually installs, and that app has no adverts and no `INTERNET`
      permission. `production/monetisation-switch.md` is the single atomic
      commit that swaps it in.
- [x] **Phone screenshots re-captured from the shipping build.** Six 1080×1920
      PNGs in `production/screenshots/`, published by
      `python tools/make_store_screenshots.py` straight out of the same captures
      stage 8 gates on, with alpha flattened and every one of Play's limits
      (count, bit depth, side length, aspect) checked rather than assumed. They
      cannot drift from the build again without the sweep noticing.

## Blocking, outside this repository

### Play Console
- [ ] Developer account and the $25 fee.
- [ ] Enrol in Play App Signing.
- [ ] **Data safety** form. The app collects nothing: no account, no analytics,
      no network calls anywhere in the codebase, and the manifest does not even
      declare `INTERNET`. All progress is a local JSON file in private storage.
- [ ] **IARC content rating.** Combat is a health bar and a particle burst
      against stylised creatures — no gore, no human targets, no blood, which
      is normally Everyone 10+ / PEGI 7. Answer the questionnaire honestly
      rather than copying that; a wrong answer is a policy strike.
- [ ] Target audience and content. 13+; targeting under-13 pulls the app into
      the Families policy.
- [ ] Ads declaration: **No**.
- [ ] App access: no login required, nothing gated.
- [ ] Privacy policy URL field.
- [ ] The news / financial / health / government declarations (all No).

### Calendar, not a form
- [ ] **Closed testing: 12 testers for 14 continuous days**, if the developer
      account is a personal one created after 2023-11-13. Production access is
      not granted until it completes.

### Hardware
- [ ] **Run the game on a physical device.** It never has. See
      `TESTING-GUIDE.md` stage 2.

## Not blocking, but decide before launch
- [ ] **Text is pixel-exact at 1920 high and nowhere else.** The CanvasScaler
      matches on height against a 1080×1920 reference, so only integer factors
      land every 9px tier on whole glyph boxes. Three ways out, none taken:
      accept it, switch to constant-pixel-size scaling with letterboxing, or
      author the face at a second size.
- [ ] **`x86_64` is not built.** arm64-v8a only, which excludes ChromeOS and
      every standard emulator. Play splits an AAB per ABI, so adding it costs
      end users nothing.
- [ ] Cloud saves via Play Games Services. `SaveManager.GetFullSaveText()`
      already returns exactly the document a provider would upload.
- [ ] Localisation. Every string is inline English.
- [ ] Analytics for the balance assumptions.

## Monetisation — deliberately absent, and ready to switch on

`production/monetisation-switch.md` is the whole list, as one atomic commit.

## Monetisation — deliberately absent

`MonetizationManager.UseStubProviders` is `true`, so `PaidSurfacesAvailable` is
`false` and every paid surface is hidden. There is no ad SDK and no Play Billing
library in the bundle, the app shows no ads and takes no money, and
`production/store-listing.md` declares exactly that. **This ships as-is.**

Shipping monetised instead is a project, not a checkbox: a real ad SDK, Play
Billing, **server-side receipt validation** (a client-only "purchase succeeded"
is trivially spoofable), SKUs created in Play Console matching `store_id` in the
product definitions, and a decision about where entitlements live — today they
are plain strings in the save file, which is the right call for a local cache
and the wrong one for an authority. Flip `UseStubProviders`, the two listing
declarations, the Data Safety form and the `AD_ID` permission declaration in
one change, never separately.

## Known deliberate gaps

- **Two worlds ship** (Dark Forest 1–50, Frozen Ruins 51–100); the GDD sketches
  five. World 3+ is pure data and needs no code.
- **`WorldManager` does not unlock past the last world's boss**, so the
  level-100 boss currently leads nowhere. Correct until World 3 exists.
- **Astral Shards: ~420 earnable against 740 needed** for every cosmetic, so
  the two most expensive trails are unreachable while monetisation is stubbed.
