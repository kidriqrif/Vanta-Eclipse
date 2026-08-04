# Vanta Eclipse — Release Checklist

**The game is feature-complete and internally consistent, but it is NOT ready
to submit to Google Play.** Everything under "Blockers" must be done first.

What is left genuinely cannot be done from inside this repository: each
remaining item needs a Google account, a licence accepted by a human, a
credential, or a physical device. Everything that *could* be produced here —
the export presets, the icons, the store graphics, the listing copy, the
privacy-policy draft — now exists.

This file lists *what must exist*. `TESTING-GUIDE.md` lists *what must be
proven*, staged from "does it launch at all" through to production rollout —
start there. The project now boots headless on desktop and every screen has
been rendered and inspected, but it has **never run on Android hardware**.

---

## BLOCKERS — must be done before any store submission

### 0. There is no export pipeline yet — nothing can be built at all

This section used to be missing, and the items below it were listed as
"verified in-repo" when no file backed them. Until all three exist, every
later item is untestable, because no artifact can be produced.

- [x] **Godot 4.7 export templates installed.** 35 files in
      `%APPDATA%/Godot/export_templates/4.7.stable/`, including the
      `android_source.zip` the export error named.
- [x] **`export_presets.cfg` created and committed.** Two presets: `Android`
      (Gradle build, AAB, arm64-v8a, min SDK 24, target SDK 35, signed) and
      `Android Debug APK` (prebuilt template, for the first device test).
      Verified by running `--export-release "Android"`: Godot now parses and
      selects the preset and fails only on the SDK below, which is what
      proves the file is valid rather than merely present.
      It is **tracked on purpose** — keeping it untracked is exactly why this
      checklist drifted. Credentials go in `export_credentials.cfg`, which is
      gitignored.
- [x] **JDK 17 and the Android SDK installed**, licences accepted, and Godot's
      Editor Settings pointed at both. Locations (all outside the repo):

      | | |
      |---|---|
      | JDK 17 | `C:/Users/kidri/dev-tools/jdk-17` (Temurin 17.0.13) |
      | Android SDK | `C:/Users/kidri/Android/Sdk` |
      | packages | platform-tools, build-tools 35.0.0 + 36.0.0, platforms 35 + 36 |
      | debug keystore | `C:/Users/kidri/.android/debug.keystore` |

- [x] **Android build template installed** to `android/build/`, with the
      `android/.build_version` marker Gradle export refuses to run without.
      `android/` is gitignored — it is 160 files of generated Gradle scaffold.
- [x] **A debug APK actually builds** — 29.9 MB, and verified rather than
      merely produced: `apksigner` confirms APK Signature Scheme v2 and v3,
      and `aapt2 dump badging` reports package
      `com.kidriqrif.vantaeclipse`, versionCode 1, arm64-v8a only, adaptive
      icon layers packaged, and exactly three permissions (INTERNET,
      ACCESS_NETWORK_STATE, VIBRATE).
- [x] **The signed release AAB builds** — `build/vanta-eclipse.aab`, 28.0 MB,
      Gradle custom build. Verified as a real Play bundle, not just a file:
      correct `base/manifest` + `base/dex` + `base/lib` layout, `BundleConfig.pb`
      present, `jarsigner -verify` reports "jar verified", arm64-v8a only, and
      the signer's SHA-256 matches the upload keystore exactly.
- [x] `tools/build_android.sh debug|release` captures the whole invocation —
      toolchain paths, signing environment variables, and the post-build
      verification — so none of it lives only in someone's shell history.
      Both paths were re-run from the script from a clean `build/` to confirm
      they reproduce.

**This is uploadable.** What stops it being *releasable* is §1: the build
still contains stub ads and stub billing, so every purchase in it is free.
Do not push it past Internal Testing until that is real.

**Confirm the package name before the first upload.** It is currently
`com.kidriqrif.vantaeclipse`, which I chose from the GitHub account. It is
**permanent once published** — Play will never let it change — so if you own
a domain, use it instead.

**Check the target SDK against current policy.** It is set to 35. Play raises
the minimum target API every August, so verify the requirement for the month
you actually submit in.

### 1. Real ads and billing (Milestone 14 shipped stubs)
- [ ] Add the Godot Android **AdMob** plugin (or chosen network) to the build.
- [ ] Implement `AdMobProvider extends AdProvider` in
      `scripts/monetization/`. The contract is one method.
- [ ] Add the **Google Play Billing** plugin.
- [ ] Implement `PlayBillingProvider extends BillingProvider`, including
      `restore_purchases()` — the Shop already calls it.
- [ ] **Server-side receipt validation.** A client-only "purchase succeeded"
      is trivially spoofable. Nothing that costs real money may be granted on
      the client's word alone.
- [ ] Decide where entitlements *live*. Today they are plain strings in
      `user://savegame.json`, so adding `"remove_ads"` to the `entitlements`
      array by hand grants it. `load_save_data()` deliberately does not filter
      that array — an unrecognised entitlement is preserved rather than
      erased, so a product `.tres` that fails to load can never destroy
      something a player paid for. That is the right call for a local save and
      the wrong one for an authority: once billing is real, the store's
      response (not the save file) must be what grants an entitlement, with
      the save acting only as an offline cache.
- [ ] Create the SKUs in Play Console matching `store_id` in
      `data/products/*.tres` (`vanta_remove_ads`, `vanta_starter_pack`,
      `vanta_shards_small`).
- [ ] Set `MonetizationManager.USE_STUB_PROVIDERS = false`.
- [ ] Verify the Shop's development banner disappears once it is false.

**Until this is done every purchase in the build is free and local, and every
"ad" is a 3-second timer.**

### 2. Identity and signing
- [x] `package/unique_name` set to `com.kidriqrif.vantaeclipse` (no longer
      Godot's rejected `com.example.*` default) — but see the confirmation
      note in §0 before the first upload, because it can never be changed.
- [x] `version/code=1` and `version/name="0.1.0"`, matching `project.godot`.
      Bump `version/code` on every upload; Play rejects a repeat.
- [x] **Upload keystore generated**, RSA 2048, valid to 2053:
      `C:/Users/kidri/keystores/vanta-eclipse-upload.jks`, alias `upload`,
      password in `vanta-eclipse-upload.password.txt` beside it. Both are
      outside the repo, and `.gitignore` covers the extensions anyway — which
      matters here because the Stop hook auto-pushes to a **public** repo.
      SHA-256 fingerprint:
      `3A:5B:8A:01:C8:37:06:8B:CB:F1:06:B3:2A:45:3B:6C:8D:9E:EE:3A:9B:8D:9C:EA:EB:9C:DB:A0:AB:D2:62:13`

      > **Back this file up somewhere you control, today.** If you lose it you
      > cannot ship an update to an app signed with it. (Play App Signing can
      > reset an *upload* key on request, which is a strong reason to enrol in
      > it when you create the app — but do not rely on that.)

      Godot reads the password from `GODOT_ANDROID_KEYSTORE_RELEASE_*`
      environment variables, which `tools/build_android.sh` sets from the
      password file — so it never enters `export_presets.cfg`, which is
      tracked.

### 3. Store assets

All generated from the theme's own values, so the listing and the game agree.
`tools/make_icons.py` rebuilds them all (pixel art, integer-scaled).

- [x] **`icon.png` redrawn** — a 128×128 pixel-art eclipse mark in the
      palette's `crimson`/`blood` on `void`, replacing the SVG that the
      revamp made the last vector asset in the project.
- [x] Launcher icon 192×192 and both 432×432 adaptive layers. Foreground art
      sits inside the 264px safe circle; background is fully opaque; the
      occluded disc is punched to transparent, not to black, so launcher
      parallax cannot reveal a seam.
- [x] 512×512 store icon, alpha channel stripped (Play rejects one that has
      an alpha channel even when every pixel is opaque).
- [x] Feature graphic 1024×500, composed in Godot with the project font.
- [x] 6 phone screenshots in `production/screenshots/`, 540×960 — exact 9:16
      and inside Play's 320–3840 range. **Not** 1080×1920: this display is
      1920×1080, so a taller window gets silently clamped and the aspect
      guard rejects the run. Recapture on the device during Stage 2 testing
      if you want them sharper.
- [x] Short and full description, categorisation, and Data Safety notes:
      `production/store-listing.md`.
- [ ] **Host the privacy policy.** Text drafted in
      `production/privacy-policy.md`, but it has placeholders to fill and
      needs a public URL before it counts.

### 4. Legal / policy
- [ ] Privacy policy covering ad SDK data collection (required once an ad SDK
      is present).
- [ ] Play **Data Safety** form.
- [ ] Ads declaration; families-policy review if targeting under-13.
- [ ] `AD_ID` permission declaration for Android 13+ if the ad SDK needs it.

---

## Verified in-repo

Everything in this section is backed by a file in the repository, and the file
is named so the claim can be checked.

Three entries used to sit here — "arm64-v8a only, min SDK 24, target SDK 34,
AAB output", "`design/`, `tools/` and scratch excluded from the export", and
"permissions limited to internet, network state, and vibrate" — while
`export_presets.cfg` did not exist at all. They were checked-off claims with
nothing behind them. All three are now genuinely true, because the preset was
written (§0); they are listed there rather than here, next to the settings
they describe.

- [x] Portrait 1080×1920, `canvas_items` stretch, `expand` aspect
      (`project.godot`), confirmed rendering on 7 Android aspect ratios from
      9:16 to 5:6 via `tools/aspect_matrix.sh`.
- [x] Mobile renderer; ETC2/ASTC VRAM compression enabled (`project.godot`).
- [x] One accent on neutrals, enforced rather than asserted. The Milestone-15
      overhaul reached the theme and the sprites but not per-scene
      `theme_override_colors` or per-script colour constants: 58 saturated
      non-red values were still live, including the violet boss countdown bar
      and both "retired" door accents (Eclipse teal, Arcade lime). All are now
      on the palette, moved onto theme variations (`AccentLabel`,
      `AccentHeaderLabel`, `MutedLabel`) or `UIPalette` accessors rather than
      restated as literals. `check_ui.py` now fails any UI colour with real
      chroma outside the red family, so this cannot drift again silently.
- [x] Atomic save with a backup slot and a versioned document
      (`SaveManager`), so a crash mid-write cannot corrupt progress.
- [x] Every manager's save section defaults cleanly when absent, so old saves
      load without migration.
- [x] Static sweep green: `bash tools/validate_all.sh` — eleven stages: `gdparse`,
      `gdlint`, the scene/resource structural validator, autoload
      member-existence, call-site arity, plus the debug-pass checkers
      `check_scripts.py`, `check_data.py` and `check_wiring.py`,
      `check_architecture.py` (docs/ARCHITECTURE.md against the code),
      `check_shaders.py` (shader structure and material parameters), and the
      font-safe glyph check.
      Every one of those checkers has a positive control in
      `tools/selftest_checks.py`, which injects 26 real defects into a copy of
      the project and requires each to be rejected — so a green sweep means the
      checks ran, not merely that they printed OK.

---

## Recommended before launch (not blocking)

- [ ] **Play on a real low-end device.** The project boots headless and all 28
      screens render, but it has never run on Android and never been touched
      by a finger. Frame pacing, touch accuracy, battery draw and the actual
      feel of every screen are unverified. The static sweep is
      deliberately broad, but it can only compare what the files say to each
      other; no amount of it substitutes for one session on hardware.
      `TESTING-GUIDE.md` Stage 2 covers this; note that a shader which compiles
      on desktop can still fail on a mobile GPU.
- [ ] Cloud saves via Play Games Services. `SaveManager.get_full_save_text()`
      already returns exactly the document a provider would upload.
- [x] Audio. 15 SFX and one 24-second seamless music loop, all generated by
      `tools/make_audio.py` and wired through `AudioManager` off `EventBus`.
      Dry and mechanical to match the pixel art — square waves and relay
      clacks, not sines.
- [ ] Localisation. All strings are inline English.
- [ ] Analytics for the balance assumptions — every economy number was tuned by
      simulation against a *model* of a player, never against real ones.
- [ ] Object-pool damage numbers if profiling shows pressure at high attack
      speed (`scripts/ui/damage_number.gd` notes this).

---

## Known deliberate gaps

- **Two worlds ship** (Dark Forest 1–50, Frozen Ruins 51–100). The GDD sketches
  five. World 3+ is pure data — a `WorldDefinition`, enemy `.tres` files and
  boss definitions — and needs no code.
- **`WorldManager._on_boss_fight_won`** returns without unlocking when the last
  world's boss dies, so the level-100 boss currently leads nowhere. That is
  correct until World 3 exists, and the TODO marks it.
- **No audio assets**, per above.
