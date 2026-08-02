# Vanta Eclipse — Release Checklist

Status as of Milestone 15. **The game is feature-complete and internally
consistent, but it is NOT ready to submit to Google Play.** Everything under
"Blockers" must be done first, and none of it could be done inside this
repository — each item needs an account, a credential, a device, or an SDK.

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

- [ ] **Install the Godot 4.7 export templates.**
      `%APPDATA%/Godot/export_templates/` is present but empty, so any
      `--export-release` fails before it reads the project.
- [ ] **Create `export_presets.cfg` with an Android preset.** There is no
      such file, and there never has been — `git log --all` has no commit
      touching it. Every export setting the rest of this checklist refers to
      (architecture, SDK levels, AAB output, permissions, exclude filters,
      launcher icons, package name, version code) lives *only* here, so none
      of them currently have a value at all.
- [ ] **Install the Android build template** (`android/`, via Project →
      Install Android Build Template). The AdMob and Play Billing plugins
      both require a custom build; the stock template cannot load them.

**Note on committing the preset.** `export_presets.cfg` is currently in
`.gitignore`, which is the common advice because Godot historically wrote
keystore passwords into it. Since 4.4 those live in a separate
`export_credentials.cfg`. Prefer committing `export_presets.cfg` — it is
build configuration, and keeping it untracked is exactly why the claims below
drifted unnoticed — and gitignoring `export_credentials.cfg` instead.

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
- [ ] Set `package/unique_name`. It has no value yet (§0 — the preset does not
      exist). Godot's default is `com.example.$genname`, which Play rejects;
      pick a domain you control.
- [ ] Generate an upload keystore; configure signing (never commit the
      keystore or its passwords — see the widened patterns in `.gitignore`,
      and note that the Stop hook auto-pushes to a **public** repo).
- [ ] Set `version/code` and `version/name` per release. `project.godot` says
      `config/version="0.1.0"`; there is no `version/code` anywhere.

### 3. Store assets (none exist in the repo)
- [ ] **Replace `icon.svg`.** It is still the placeholder: a 128×128 purple
      circle (`#a78bfa` on `#0b0812`) left over from the pre-red palette, so
      the launcher icon currently contradicts the whole game's colour scheme.
- [ ] Launcher icons: 192×192 and the two 432×432 adaptive layers.
- [ ] 512×512 32-bit PNG store icon, feature graphic 1024×500, short and full
      description, privacy policy URL.
- [ ] At least 2 phone screenshots. `tools/screenshot_run.sh` already renders
      28 screens, but at 540×960 — re-render at `SHOT_RES=1080x1920` for the
      listing.

### 4. Legal / policy
- [ ] Privacy policy covering ad SDK data collection (required once an ad SDK
      is present).
- [ ] Play **Data Safety** form.
- [ ] Ads declaration; families-policy review if targeting under-13.
- [ ] `AD_ID` permission declaration for Android 13+ if the ad SDK needs it.

---

## Verified in-repo

Everything in this section is backed by a file in the repository. Claims about
*export* settings deliberately do not appear here — they live in
`export_presets.cfg`, which does not exist (§0). Three former entries
("arm64-v8a only, min SDK 24, target SDK 34, AAB output", "`design/`, `tools/`
and scratch excluded from the export", "permissions limited to internet,
network state, and vibrate") were listed here as verified despite having no
file to verify against, and are now blockers instead.

- [x] Portrait 1080×1920, `canvas_items` stretch, `expand` aspect
      (`project.godot`), confirmed rendering on 7 Android aspect ratios from
      9:16 to 5:6 via `tools/aspect_matrix.sh`.
- [x] Mobile renderer; ETC2/ASTC VRAM compression enabled (`project.godot`).
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
      `tools/selftest_checks.py`, which injects 25 real defects into a copy of
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
- [ ] Audio. There is none: `SettingsManager` carries volume settings and the
      audio buses exist, but no music or SFX assets were ever authored.
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
