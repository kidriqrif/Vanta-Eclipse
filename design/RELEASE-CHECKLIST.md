# Vanta Eclipse — Release Checklist

Status as of Milestone 15. **The game is feature-complete and internally
consistent, but it is NOT ready to submit to Google Play.** Everything under
"Blockers" must be done first, and none of it could be done inside this
repository — each item needs an account, a credential, a device, or an SDK.

---

## BLOCKERS — must be done before any store submission

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
- [ ] Create the SKUs in Play Console matching `store_id` in
      `data/products/*.tres` (`vanta_remove_ads`, `vanta_starter_pack`,
      `vanta_shards_small`).
- [ ] Set `MonetizationManager.USE_STUB_PROVIDERS = false`.
- [ ] Verify the Shop's development banner disappears once it is false.

**Until this is done every purchase in the build is free and local, and every
"ad" is a 3-second timer.**

### 2. Identity and signing
- [ ] Replace `package/unique_name` — it is currently
      `com.example.vantaeclipse`, which Play will reject.
- [ ] Generate an upload keystore; configure signing (never commit the
      keystore or its passwords).
- [ ] Set `version/code` and `version/name` per release.

### 3. Store assets (none exist in the repo)
- [ ] Launcher icons: 192×192 and the two 432×432 adaptive layers.
- [ ] Feature graphic 1024×500, at least 2 phone screenshots, short and full
      description, privacy policy URL.

### 4. Legal / policy
- [ ] Privacy policy covering ad SDK data collection (required once an ad SDK
      is present).
- [ ] Play **Data Safety** form.
- [ ] Ads declaration; families-policy review if targeting under-13.
- [ ] `AD_ID` permission declaration for Android 13+ if the ad SDK needs it.

---

## Verified in-repo

- [x] Portrait 1080×1920, `canvas_items` stretch, `expand` aspect.
- [x] Mobile renderer; ETC2/ASTC VRAM compression enabled.
- [x] arm64-v8a only, min SDK 24, target SDK 34, AAB output.
- [x] `design/`, `tools/` and scratch excluded from the export.
- [x] Permissions limited to internet, network state, and vibrate.
- [x] Atomic save with a backup slot and a versioned document
      (`SaveManager`), so a crash mid-write cannot corrupt progress.
- [x] Every manager's save section defaults cleanly when absent, so old saves
      load without migration.
- [x] Static sweep green: `bash tools/validate_all.sh` — `gdparse`, `gdlint`,
      the scene/resource structural validator, autoload member-existence,
      call-site arity, plus the debug-pass checkers `check_scripts.py`,
      `check_data.py` and `check_wiring.py`, and the font-safe glyph check.
      Every one of those checkers has a positive control in
      `tools/selftest_checks.py`, which injects 13 real defects into a copy of
      the project and requires each to be rejected — so a green sweep means the
      checks ran, not merely that they printed OK.

---

## Recommended before launch (not blocking)

- [ ] **Play on a real low-end device.** Nothing in this project has ever been
      run — it is validated statically, not empirically. Frame pacing, touch
      accuracy, battery draw and the actual feel of every screen are unverified.
      The static sweep is deliberately broad, but it can only compare what the
      files say to each other; no amount of it substitutes for one session on
      hardware.
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
