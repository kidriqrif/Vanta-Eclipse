# Vanta Eclipse — Testing Guide

How to get from "validated statically" to "safe to submit". Read
`RELEASE-CHECKLIST.md` alongside this: that file lists *what must exist*, this
one lists *what must be proven*.

**Start here.** The project has never been opened in the Godot editor — there
is no `.godot/` import cache. Every line of it is unexecuted. The static sweep
(`bash tools/validate_all.sh`) is deliberately broad and it is green, but it
only compares what the files say to each other. It cannot catch a shader that
fails to compile, an `_ready()` that dereferences null, or a screen that lays
out wrong. Budget real time for Stage 0 turning up problems; that is what it
is for, and finding them there is much cheaper than finding them in review.

---

## Stage 0 — Does it run at all?

Nothing downstream matters until this passes.

1. **Install Godot 4.7 (standard build, not .NET).** `project.godot` declares
   `config/features = ("4.7", "Mobile")`. An older 4.x will refuse the config
   version; a newer one will offer to upgrade the project — let it, then re-run
   `bash tools/validate_all.sh` before trusting anything.
2. **Open the project.** First import rasterises 49 SVGs and builds `.godot/`.
   This takes a while and is one-time.
3. **Watch the Output and Errors panels during import, not just after.** This is
   the first time `effects/dimensional_sprite.gdshader` and
   `effects/nebula_background.gdshader` are ever compiled.
4. **Press F5.**

### What is most likely to break, in order

| Risk | Why it is the risk | What you would see |
| --- | --- | --- |
| `dimensional_sprite.gdshader` fails to compile | Written without a compiler available — `check_shaders.py` is static and cannot prove a shader compiles | Enemy renders black, white, or untextured; shader error in Output |
| An autoload `_ready()` throws | 19 autoloads all run at boot, in order, before any screen | Black screen, or a stack trace naming a manager |
| A `%UniqueName` misses at runtime | Statically checked, but scene-tree timing is not the same thing | `Node not found` on entering a screen |
| A `.tres` fails to load into its typed property | Property names are checked, runtime coercion is not | Null texture, or a definition silently defaulting |

If the enemy sprite looks wrong, **first test**: select `EnemySprite` in
`scenes/gameplay/enemy_view.tscn` and clear its `material`. If the sprite then
renders correctly, the shader is the fault and the Output panel has the compile
error. Send me that text.

### Automating Stage 0

```bash
GODOT=/path/to/godot bash tools/screenshot_run.sh [output_dir]
VANTA_SHOT_ONLY=gear bash tools/screenshot_run.sh   # one screen, fast loop
```

Runs the game windowed on the real renderer and walks **every** screen, panel,
minigame and transient in it — 27 PNGs, in two passes. The first is the cold
save a new player boots into, where the empty states are the thing being
checked; the second seeds a late-game save and re-shoots the screens whose job
is rendering content, plus the doors a cold save hides. It registers
`tools/screenshot_harness.gd` as the last autoload and restores `project.godot`
afterwards, including on crash or Ctrl-C. Output defaults to `.godot-shots/`,
which is gitignored.

Coverage is the whole game rather than a sample because a defect confined to
one screen is exactly what static checks pass and nobody notices: Gear can be
broken for a week while gameplay looks perfect.

**The window cannot be bigger than your desktop.** Asking for the project's
native 1080x1920 on a 1080p monitor silently gives a ~1080x1050 window, and
`stretch/aspect="expand"` then renders a near-*square* viewport — in one
measured case 2468x1920, well over twice the intended width. The screenshots
still look entirely plausible, which is what makes it dangerous: every
judgement about layout is quietly wrong and nothing says so. `SHOT_RES`
therefore defaults to **540x960** — exact 9:16, half scale, identical layout —
and the harness prints the viewport aspect on every run and shouts if it does
not match the phone. It found a real bug the moment it was fixed: the Gear
badge covering its own button label, invisible at the stretched aspect because
the bottom row was twice as wide as a phone ever gives it.

The script also runs `--headless --import` first. A newly added `.svg` has no
import sidecar, so every reference to it fails — and because the theme is one
resource, **one** unimported sprite takes the whole theme down and the game
boots unstyled, while the static sweep stays green because the file is on disk
and the path resolves. `.godot/` is gitignored, so a fresh clone is always in
exactly that state.

Three more things this covers that nothing else does:

* **Shaders actually compile.** `--headless` uses the dummy rasterizer and
  never compiles one, so a clean headless boot says nothing about `effects/`.
* **The result is visible.** A screenshot is the only artifact that shows
  whether the screen looks like anything. The first real run of this project
  proved the point: every static check was green, yet the enemy's contact
  shadow was invisible — a near-black shadow on a near-black backdrop. It is
  now a tinted ground glow.
* **It is cheap to repeat.** Re-run it after any visual change.

Expect a handful of `ObjectDB instances were leaked at exit`. That is the
harness quitting mid-`await`, not the game — a plain `--headless --quit-after
300` boot exits clean, which is the check to run if you want to be sure.

---

## Stage 1 — Desktop playthrough

Run from the editor so you can see errors as they happen. Play with the Output
panel visible; an idle game hides errors well because it keeps running.

### Getting to late game without playing for hours

The save is **plain JSON at a known path**, which makes state-jumping easy:

* Windows: `%APPDATA%\Godot\app_userdata\Vanta Eclipse\savegame.json`

Quit the game, edit `sections.combat.enemy_level`, relaunch. This is the only
practical way to test gates 50/100/110, prestige, and the deep-world walls.
Keep a copy of a fresh save and a late save; you will want both repeatedly.

### Regression paths for the ten defects fixed in `4d92de9`

Each was a real bug with a specific reproduction. Walk them deliberately —
these are the paths most likely to have been disturbed.

1. **Swift Hunt** — with auto-attack unlocked, buy a Swift Hunt level. The
   live attack must speed up *immediately*, without leaving the screen.
2. **Tap trail** — buy and equip any "… Trail" cosmetic, then tap. Particles in
   the cosmetic's colour must appear under your finger. (No trail on
   auto-attacks; that is deliberate.)
3. **Boss loot latch** — start a boss fight, tap ECLIPSE *during* it, complete
   the prestige. Equipment must still drop in the new run.
4. **Windows sweep** — already proven: `bash tools/validate_all.sh` is green on
   a `cp1252` machine.
5. **Past level 100** — set `enemy_level` to 108, climb through gate 110. The
   final world boss must repeat, with no `push_error` spam on CHALLENGE BOSS.
6. **Banner queue** — kill a Frozen Ruins gate boss that drops a relic and a
   mythic. All banners must play in sequence, none skipped.
7. **Scene-load failure** — hard to trigger honestly. To force it, temporarily
   point a `SCENE_*` constant in `scene_manager.gd` at a nonexistent path,
   navigate there, then confirm combat still spawns enemies afterwards. Revert.
8. **Crystal shortfall** — with 39 Void Crystals against a 40-cost node, the
   button must read "NEED 1 MORE", not "NEED 40 MORE".
9. **Journal label** — fill the Arcade token meter, then claim a reward from the
   ACHIEVEMENTS tab. The refusal message must appear and then hand the label
   back; no stray "Resets in 7h" left on that tab.
10. **Daily rollover** — leave the app running across UTC midnight (or set the
    system clock forward). Dailies must reroll within ~60s without a restart.

### Integrity checks

- [ ] **Save/load round trip.** Play, quit, relaunch. Currencies, level,
      inventory, equipped items, relics, pets, skills, quests all restore.
- [ ] **Kill mid-save.** Force-quit during an autosave. Progress survives via
      the backup slot (`SaveManager` writes atomically — verify it actually does).
- [ ] **Fresh install.** Delete `savegame.json`. First-run flow works and the
      tutorial chain is not skipped.
- [ ] **Offline progression.** Quit, set the system clock forward 2 hours,
      relaunch. Reward is granted, capped at 8 hours, and enemy level has *not*
      advanced. Then set the clock *backwards* and confirm nothing is granted
      and nothing goes negative.
- [ ] **Prestige.** Eclipse resets run state and preserves Ascendant Powers.

---

## Stage 2 — Real Android device

The single highest-value stage, and the one nothing in this repo can substitute
for. Mobile GPUs and mobile GLSL are stricter than desktop: **a shader that
compiles on desktop can still fail on a device.**

1. Install the Godot **export templates** for 4.7 (Editor → Manage Export
   Templates).
2. Install the **Android build template** into the project (Project → Install
   Android Build Template) — creates `android/`, which is gitignored.
3. Set up the Android SDK path and a debug keystore in Editor Settings.
4. Export a **debug APK** and install it. Do not go near an AAB yet.

- [ ] **The shader on real hardware.** Look at the enemy on the device
      specifically. This is a different compiler than desktop.
- [ ] **A genuinely low-end device.** The renderer is `mobile` and the art
      budget assumes weak GPUs. Test the oldest phone you can find, not your
      newest.
- [ ] **Frame pacing** during the busiest moment: a boss kill firing four
      banners, particles, damage numbers and the nebula backdrop at once.
- [ ] **Touch targets.** The spec says ~100px minimum. Verify with a thumb, not
      a mouse.
- [ ] **Battery and thermal** over a 20-minute session. Idle games get left open.
- [ ] **App lifecycle.** Background the app, return after 10 minutes. Offline
      rewards, autosave-on-background, and audio focus all behave.
- [ ] **Rotation lock.** Portrait only, as configured.
- [ ] **Back button** does something sane on every screen.
- [ ] **Resolutions.** A tall 20:9 phone and a 16:9 tablet — `expand` aspect
      means layouts can stretch unexpectedly.

Use `adb logcat -s godot` to see runtime errors on device; they are invisible
otherwise.

---

## Stage 3 — Play Console internal testing

Do **not** reach this stage before the Blockers in `RELEASE-CHECKLIST.md` are
closed. Two are absolute:

* `package/unique_name` is still `com.example.vantaeclipse` — Play rejects it,
  and **the package name is permanent once published**.
* `USE_STUB_PROVIDERS = true` means every purchase is free and local and every
  ad is a timer. Shipping that is shipping a free IAP exploit.

1. Create the app in Play Console; upload a signed **AAB** to the **Internal
   testing** track.
2. **Read the pre-launch report.** Google runs your build on real physical
   devices automatically and reports crashes, ANRs, and rendering issues. For a
   project that has never run on hardware this is the single most valuable free
   signal available.
3. Test **billing in the sandbox** with a licence-tester account: every SKU
   purchases, `restore_purchases()` restores, and a cancelled purchase grants
   nothing.
4. Verify **server-side receipt validation** rejects a replayed or forged
   receipt. A client-only "purchase succeeded" is trivially spoofable.
5. Confirm real ads load, and that failure to load degrades gracefully rather
   than blocking a reward.

- [ ] Install from the store listing on a device that has never had the app.
- [ ] **Upgrade path:** install the previous build, play, then update in place.
      Saves must survive. This is what `SAVE_VERSION` and `_migrate()` exist
      for, and it has never been exercised — there is only one version so far.

---

## Stage 4 — Closed testing, then production

Google requires a period of closed testing with real testers before a personal
developer account can promote to production; check the current requirement in
Console, as it has changed over time.

- [ ] Data Safety form matches what the ad SDK actually collects.
- [ ] Privacy policy URL is live and reachable.
- [ ] Content rating questionnaire completed.
- [ ] Staged rollout (start at a small percentage), with crash monitoring.

---

## What this project cannot tell you

Honest limits, so they are not mistaken for covered ground:

* **Balance.** Every economy number was tuned by simulation against a *model*
  of a player. Whether the level-70 wall feels earned or punishing is unknown
  until real people play. Instrument it before trusting it.
* **Audio.** There is none. Buses and volume settings exist; no assets were
  authored.
* **Feel.** Animation timings, juice, and pacing were specified in `design/ux/`
  and implemented to spec, but never watched in motion.
