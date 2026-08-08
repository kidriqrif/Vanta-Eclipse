# Vanta Eclipse — Project Context

**Start here in a new chat.** This replaces the old `HANDOFF.md`.

**Snapshot: 2026-08-08.** Everything under *Rules*, *Traps* and *How the game
plays* is durable. Everything under *Verified state* and *Google Play* decays —
re-run the sweep and re-check Play policy rather than trusting the numbers.

This file is in `check_architecture.py`'s `DOCS` list, so stage 8 of the sweep
fails if it backticks a source path that does not exist, or states an autoload
count that disagrees with `project.godot`. **Backticks mean a live path.** A
file being described historically goes in bold instead.

---

## 1. What this is

A portrait, offline, single-player idle RPG for Android. Godot 4.7, GDScript,
75 game `.gd` files, 32 scenes, 21 autoload managers, 101 `.tres` content
definitions, 57 generated sprites, 16 generated sounds. Pixel art on a closed
16-colour palette. Feature-complete through Milestone 15. **No monetisation is
active** — the build ships with no ad SDK and no billing library.

The repository is public: `github.com/kidriqrif/Vanta-Eclipse`.

## 2. Read in this order

| Document | What it is | Trust |
|---|---|---|
| This file | Orientation, rules, current state | Current |
| `docs/ARCHITECTURE.md` | How the systems fit together | High — enforced by stage 8 |
| `design/RELEASE-CHECKLIST.md` | What must *exist* before submission | **Partly stale** — see §8 |
| `design/TESTING-GUIDE.md` | What must be *proven*, staged | **Partly stale** — see §8 |
| `design/gdd/game-concept.md` | Original design intent, milestone log | Historical |
| `design/ux/milestone-*.md` | Per-milestone UX specs | Historical — predate the pixel-art restyle |
| `production/store-listing.md` | Copy-paste source for Play Console fields | Current |

For code questions in `scripts/` or `scenes/`, **use Grep and Read**. The
graphify knowledge graph has no GDScript grammar and contains none of the game
scripts — see `CLAUDE.md`. It is useful for `tools/`, `docs/` and `design/`.

---

## 3. How the game actually plays

### The minute-to-minute loop

Tap the enemy. It dies, you get Eclipse Essence and the enemy level goes up by
one. Spend essence in the upgrade shop. Repeat.

Enemy HP grows **15% per level**; essence reward grows **9% per level**. That
widening gap is the entire pressure model — it is what makes upgrades feel
necessary rather than optional. Baseline HP is `5.0 × 1.15^(level-1)`, baseline
reward `2.0 × 1.09^(level-1)`, both in `combat_manager.gd`.

### Gates and bosses

Every 10th level is a **boss gate**: 3× HP, a 30-second timer that starts 1.1s
after the entrance settles, and a 10× payout. Lose and you drop to **farm
mode** — you grind the level *below* the gate with a CHALLENGE BOSS button for a
free retry. Nothing is ever permanently lost.

The countdown never ticks behind an overlay, a scene transition, or a
backgrounded app. `CombatManager` tracks obstruction itself
(`ui_overlay_opened` / `ui_overlay_closed` / the scene-transition signals) and
holds boss entry until the screen is genuinely clear.

### Unlock ladder

| Level | What opens |
|---|---|
| 15 | Auto-attack (1.0s tick — one third of active tapping speed) |
| 20 | The Arcade |
| 50 | Dark Forest world boss → Frozen Ruins; the Eclipse door |
| 51 | Relics awaken; the starter pet is granted |
| 100 | Frozen Ruins world boss — currently the content ceiling |

Past level 100 the climb continues and the last world boss **repeats** at gates
110, 120, … rather than erroring. World 3 is a pure data drop
(a `WorldDefinition`, enemy and boss `.tres` files); the TODO is in
`world_manager.gd`.

### The systems, in the order a player meets them

**Upgrades** — 5 lines in `data/upgrades/`, bought with essence, reset on an
Eclipse.

**Equipment** — 7 slots, 5 rarities, 6 affixes. 3% drop on a normal kill,
guaranteed on a boss, world bosses roll min-Epic. Salvage gives Void Scraps
(2/5/12/30/75 by rarity); the forge pulls a random item for 20. Full gear is
about **1.45× dps** — acceleration, never a gate. Kept through an Eclipse.

**Relics** — 5 of them, one active at a time, 25% drop from Frozen Ruins
bosses. Real trade-offs: Twin Fang doubles attack cadence, and because
`IdleManager` reads one effective-interval getter, that doubles offline pay
too. Kept through an Eclipse.

**Pets** — 2, one active. XP from live kills and from the offline kill
estimate. The starter is free at awakening; the second is a 15% drop from a
Frozen Ruins boss. Kept through an Eclipse.

**Offline progression** — capped at 8 hours, paid at 50% of the live essence
rate, priced at the **effective kill level** (at a boss wall the auto-attacker
is really killing gate-1 enemies, and the payout says so). Enemy level never
advances while away: you come back to essence, not to a wall.

**The Arcade** — 7 minigames (Void Reflex, Memory Match, Connect Four,
Battleship, Lights Out, Sequence Echo, Rune Sweeper). 5 tokens max, one
regenerates every 30 minutes, 10% chance from a boss win. Payouts are priced in
*seconds of your current essence rate*, so they never go stale and never become
the optimal way to play. A loss still pays 25%.

**The Journal** — 27 goals across a linear quest chain, 3 UTC-daily goals, and
permanent achievements. Everything here is a lifetime record; an Eclipse never
takes a counter away. Nothing in it is required to progress.

**The Eclipse (prestige)** — available once a run peaks at level 50. Pays
`max(1, floor(4 × (peak/50)^2.6 × (1 + crystal_gain)))` Void Crystals. Resets
essence, upgrades, world unlocks, combat level and auto-attack. Keeps
equipment, relics, pets, cards, Arcade records, the Journal, and every
Ascendant Power.

**Ascendant Powers** — 9 permanent nodes bought with Void Crystals. They layer
into the same `PlayerStats` / `IdleManager` getters relics and pets use, so a
new power needs no combat code. Eternal Reflex hands you the auto-attacker from
level one; Long Slumber extends the offline cap; Swift Hunt quickens the tick.

**Boss trophy cards** — every boss that dies leaves one. Cards are *instances*,
not definitions: POWER, VIGOR and FOCUS are rolled at the kill from the boss's
level and the tier that came up. Only the shape of the roll is data
(`data/card_rarities/`, five tiers), so retuning drop rates never opens
`card_manager.gd`. A card's only exit is **absorption** into the *active*
companion — POWER becomes pet XP, VIGOR becomes a permanent addition to that
pet's passive, and the card is destroyed. Nothing is equippable and there is no
card slot on purpose: a collection you must curate is a second inventory, and
the game already has one. Absorption targets the active pet specifically so the
choice of which companion grows stays visible.

**The Shop** — cosmetics only in this build: 6 tap trails bought with Astral
Shards.

### Currencies

Eclipse Essence (main), Void Crystals (prestige), Astral Shards (cosmetic),
Void Scraps (salvage/forge). All four live in `currency_manager.gd`; nothing
outside it may change a balance.

---

## 4. How the code is arranged

Read `docs/ARCHITECTURE.md` for the full picture. The three things to know
before touching anything:

**Managers own state, scenes are windows.** All long-lived logic is in 21
autoload managers under `scripts/managers/`. Screens read from them, render
signals, and forward input back. **Scenes never own game state.**

**Load order is load-bearing** and is verified against `project.godot` by
`check_architecture.py`. Inside `_ready()` an autoload may only touch autoloads
declared above it. At runtime any direction is safe, but upward calls should
earn their place — there are two in the whole project.

**Communication**: UI → manager is a direct call. Manager → anyone is a signal
on `EventBus`, never a direct reference to a scene. That is why adding audio to
a finished game changed no UI script: `audio_manager.gd` listens to `EventBus`
and nothing else.

**Saves** are one versioned JSON document at `user://savegame.json` with 15
sections, one per owning manager. Writes are atomic through a backup slot.
Saves from a newer build are refused and copied aside, never downgraded.
Settings live outside the save so they survive a reset.

**Content is data.** Adding an enemy is one `.tres` and one sprite, zero code.
Same for upgrades, affixes, relics, pets, skills, quests, worlds, minigames,
cosmetics and card tiers.

---

## 5. Rules that will bite you if you do not know them

**Every asset is generated.** Sprites, the bitmap font, icons and all audio come
out of `tools/make_sprites.py`, `tools/make_font.py`, `tools/make_icons.py` and
`tools/make_audio.py`. Never hand-edit a PNG or WAV — stage 13
(`tools/check_generated.py`) re-runs every generator and demands byte-identity,
so a touched file fails the build. Change the program, re-run it.

**The palette is closed at 16 colours** (`tools/pixelart.py`). Stage 12
(`tools/check_pixels.py`) checks *every pixel of every shipped PNG*, not just
source literals — 1.29M pixels across 64 images. Stage 10
(`tools/check_ui.py`) does the same for every colour in the theme, scenes and
scripts.

Changing a palette value means rewriting every `Color()` literal that used it.
`tools/snap_palette.py` snaps drifted colours to the *nearest* entry, which is
the wrong tool when hues move far — nearest can land a colour on a different
entry than the one it always was. **Migrate by palette NAME**, then run
`snap_palette.py` and confirm it reports 0 moved.

**The palette was re-valued on 2026-08-05 for contrast.** The old set was
cohesive and muted: 53.6% of all sprite ink was neutral and the most-used
colour in the game was a grey 21 points of luminance off the background it sat
on. The nine hues moved up in chroma and value; mean sprite luminance went
90.8 → 104.4 against a background at 8.6. `void` is unchanged because it *is*
the background, and `crimson` stayed crimson because the icon and the store
listing commit to red on black.

**The creature set is CELESTIAL, not medieval.** Two motifs carry it and every
creature uses at least one:

* **Eclipse** — a body DARKER than the background, ringed by the light it is
  blocking. `_corona()` draws a ring and punches the middle out rather than
  drawing a lit ball: a creature that glows is a lamp, a creature with a corona
  is a hole with light behind it.
* **Alien** — no bilateral face, no crown, no clothing. `_eye_ring()` spaces
  eyes around a circle. Where a shape must be symmetric to read, the symmetry
  is ORBITAL, not left-right.

Pets hover, carry ONE large eye, and wear the same halo scaled down — friendly
by being round rather than sharp. The halo is drawn BEHIND the body via
`_pet_base(halo=…)`; drawing it afterwards and punching its middle out erases
the body, which once shipped Blaze as a bare orange ring with nothing inside.

Four enemies were RENAMED to match what is now drawn — Thorn Fiend → Spore
Bloom, Frost Shade → Comet Drifter, Rime Fiend → Rime Cluster, Hollow Sentinel
→ Derelict Sentinel. Only `display_name` changed. **`id` is a save key and must
never be renamed.**

**Empty-slot icons are sci-fi and still NEUTRAL.** Beam emitter, ringed planet,
pressure dome, thruster, grav cuff, orbital band, hovering monolith — all in
`iron`/`ash`/`bone` on purpose. `_slot()` exists to draw ABSENCE; a glowing
laser blade would read as equipped loot in an empty socket. Change the form,
never the palette.

**`shade_stalker`'s geometry is not up for redesign.** Four attempts have failed
the same way — one-pixel limbs off a round body is a tick, a symmetric dome
with a head under it is a mushroom, and a pair of Gaussian humps filled to a
flat belly is a bridge. Restyle the surface; leave the skeleton alone.

**The font face is 6×7 in a 9-row box, monospace, advance 7.** The BOX HEIGHT
must not change: `GLYPH_H = 9` is load-bearing far outside `tools/make_font.py`
— the theme's sizes are 9×{2,3,4,5,6}, `tools/snap_font_sizes.py` snaps to it,
`check_ui.py` fails any size that is not a whole multiple of it, and the
FONTDEVICE audit reasons about it. **Every font size is a multiple of 9.** Legal
tiers in use: 18 / 27 / 36 / 45 / 54.

Punctuation is **2×2, not 1×1**. A single pixel is exactly what a fractional
window scale rounds away — it ate both periods in the main menu tagline once.

A third-party pixel font was considered and rejected: a downloaded face breaks
the byte-identity invariant and adds a licence to audit.

**Surfaces are flat.** No corner radii, no soft shadows, no gradients. A falloff
is dithered (`ground_glow()`) or hard-stepped (`menu_divider()`).

**Six tap trails must be six different colours.** They were not — two pairs were
byte-identical, so the shop sold six cosmetics that drew four trails. Now
enforced by `tools/check_data.py` with a perceptual distance floor of 120.

**The README fact block and the GitHub Pages site are generated** by
`tools/make_docs.py`. Edit prose *outside* the `<!-- generated -->` markers
freely; never inside. Stage 14 fails on drift.

**⚠ The repo auto-commits and pushes to a PUBLIC remote every turn** (a Stop
hook). Anything left in the working tree ships. Never write a credential,
keystore or API key into the repo. The upload keystore lives *outside* it and
`export_credentials.cfg` is gitignored.

**The signer fingerprint must never change.** Play binds the app to its first
upload key permanently:
`3A:5B:8A:01:C8:37:06:8B:CB:F1:06:B3:2A:45:3B:6C:8D:9E:EE:3A:9B:8D:9C:EA:EB:9C:DB:A0:AB:D2:62:13`

---

## 6. Traps this project has actually hit

The recurring failure is **a check that reports something other than what it
verifies**. Found repeatedly; assume more exist.

- A sprite scan globbing `*.svg` after every sprite became a `*.png` — passed
  vacuously for an entire restyle.
- A glyph check naming a font replaced two restyles earlier.
- A voice-pool check using `>=` that passed while 7 of 14 sounds failed to load.
- A stage reporting `tail -1` (an engine warning) instead of its own verdict.
- **All four Arcade minigames once shipped un-parseable** (`const X =
  SomeClass.f()` is not a constant expression). The whole Arcade was dead
  through a 14-stage sweep, 71 runtime checks and a screenshot pass. Now caught
  by `_check_scripts_parse` in `tools/logic_harness.gd`.
- **The main menu tagline lost both its periods** and shipped reading "Devour
  the light  Ascend". Three checks each verified a proper subset and all three
  said green. Nothing compared the rasterised glyph to the authored one — see
  §7 on device pixels.
- **`screenshot_run.sh` was never wired into the sweep and always exited 0.** It
  had been finding real problems and reporting them to nobody for as long as it
  existed. It is now stage 16, and it reads each verdict BY NAME — findings are
  prefixed `FINDING:` so a grep cannot mistake the first complaint about one
  screen for the conclusion about all of them.
- **A tooling autoload got COMMITTED AND PUSHED.** `tools/screenshot_run.sh`
  injects an autoload into `project.godot` for the length of a run and removes
  it on exit — safe until something commits the file mid-run, which the
  auto-commit hook did while `tools/aspect_matrix.sh` was left running across a
  turn boundary. A commit shipped an autoload that walks every screen and calls
  `quit()`, in place of the game. **Never leave a run that touches
  `project.godot` running in the background** while the auto-commit hook is
  live. `check_architecture.py` now fails any autoload whose script does not
  live under `scripts/managers/` — it asserts that PROPERTY rather than a list
  of harness names, because the first version allowlisted one harness and
  silently ignored the other.
- **Restoring a save means restoring BOTH files.** `save_manager.gd` writes
  atomically via a backup, and its load path falls back to that backup when the
  main file is missing. A harness that removes only the main file leaves its
  own seeded run in the backup slot, and the next launch restores it — a
  "reset" save that comes back at level 60 with 20 boss cards. Both
  `tools/logic_run.sh` and `tools/screenshot_run.sh` now track and restore the
  pair.
- **`screenshot_run.sh` was seeding the player's real save.** It drives a
  late-game seed and the managers it touches call `save_game()`. It hid because
  seeding looks idempotent (currencies are SET, not added); boss cards exposed
  it because they APPEND. Both scripts now back up and restore.
- **A second `trap ... EXIT` REPLACES the first, it does not run alongside it.**
  Adding one to `screenshot_run.sh` silently disabled the `project.godot`
  restore, and every run appended another autoload until stage 8 reported 23 of
  them. If you add cleanup to that script, extend `restore()` — do not add a
  trap.

**Generated output must be looked at, not reasoned about.** Every sprite that
came out wrong looked correct in source. A screenshot harness once reported four
empty screens as successes because it only measured overflow and font size.
Render it and open the image.

**Positive-control your controls.** When testing that a check catches a defect,
*assert the injection applied*. Three positive controls silently did nothing
because the anchor string did not exist in the file.

Two rules the minigame framework enforces that are easy to breach in a new
game: use CHILD `Timer`s (a `get_tree().create_timer()` is owned by the
SceneTree, so `teardown()` cannot reach it and a forfeited run plays on under
the result banner), and call `_finish()` exactly once. Lights Out scrambles by
PLAYING the board rather than randomising cells — a random 4×4 arrangement is
solvable about one time in sixteen, and a player cannot tell an unsolvable
board from a hard one. Rune Sweeper lays its field AFTER the first tap so move
one is never a coin flip.

---

## 7. Verified state, this snapshot

| Gate | Command | Result |
|---|---|---|
| Static sweep, stages 3–14 | `bash tools/validate_all.sh` | green, re-run 2026-08-08 |
| Stages 1–2 (gdparse, gdlint) | same | need `pip install gdtoolkit` |
| Stage 15 (runtime logic) | same | needs a Godot binary — not present in this container |
| Stage 16 (rendered screens) | same | needs a Godot binary and a display |
| Mutation self-test | `python tools/selftest_checks.py` | 44/44 caught (last full run) |
| Release bundle | `bash tools/build_android.sh release` | signed, `jar verified` (last full run) |

**The AAB on disk predates the palette revamp and the creature rework.** Rebuild
before uploading — the bundle still carries the muted art and the medieval
bestiary. It also is not in this repository (`build/` is gitignored), so it
exists only on the Windows machine that made it.

Bundle gates, from the merged manifest: `minSdkVersion` 24, `glEsVersion` 3.0
required, **arm64-v8a only**, native libs 16 KB-aligned, targetSdk 36. arm64
only excludes every x86_64 target, so the current AAB installs on neither
ChromeOS nor a standard emulator. Adding `x86_64` would make emulator testing
possible at no cost to end users, since Play splits an AAB per ABI.

### Device shapes — measured

`bash tools/aspect_matrix.sh` renders the whole game at ten Android shapes and
measures each. All ten passed at last run: 9:16 / 9:19.5 / 9:20 / 9:21 phones,
16:10 and 4:3 tablets, a foldable in portrait, plus three landscape shapes.

Landscape is tested because the build targets SDK 36 and **Android 16 ignores
`android:screenOrientation` on displays 600dp and wider**. The app is
portrait-locked with no landscape layout, so a tablet or unfolded foldable
shows it in landscape regardless, as will any phone in split-screen. Under
`aspect="expand"` the viewport only ever GROWS, so nothing is cropped — instead
content strands, and a width cap in `scene_manager.gd` stops it. That cap lives
as a second term inside `_apply_safe_area()`, **not** as a script on each
screen. It was tried that way and it was wrong: a per-scene script writing
margins on the same `size_changed` signal does not compose with the safe area,
it replaces it, and it silently dropped the cutout inset on exactly the notched
phones the safe area exists for.

**This is layout only.** Nothing here exercises a GPU driver, real touch input,
audio hardware, memory limits, install, or performance. **The game has never run
on a physical device.** Do not read ten green shapes as device compatibility.

### Text and device pixels — a real constraint, not yet decided

The font exists at 9px only and the theme uses 9×{2,3,4,5,6}. With
`stretch/mode="canvas_items"` the engine multiplies all of that by
window ÷ viewport, and for every tier to land on whole glyph boxes at once,
`k × stretch` must be a whole number for k = 2..6 — **only the integers satisfy
all five**. So text is pixel-exact on a 1080-wide screen and nowhere else.

Stage 16's FONTDEVICE verdict measures exactly this. It reports INCONCLUSIVE at
a fractional stretch (no layout can fix a resolution) and fails hard at an
integer one. **The OK branch is unverified** — a 1080×1920 window does not fit
on a 1080p desktop.

Three ways out, none taken — this is a design decision:
1. Accept it. Most Android handsets are 1080 wide; the cost is soft text on the
   ones that are not.
2. Switch to `stretch/mode="viewport"` with integer scaling and letterbox.
   Sharp everywhere, black bars on non-9:16.
3. Author the face at a second size, or move the theme to a single tier.

### Documents that have drifted

Flagged rather than rewritten, so nobody reads them as fact:

* `design/RELEASE-CHECKLIST.md` says target SDK 35 in two places (it is 36),
  says "28 screens" (32), and its last line says "No audio assets" while an
  item above it correctly records that audio shipped.
* `design/TESTING-GUIDE.md` Stage 3 says the package name is still
  `com.example.vantaeclipse` (it is `com.kidriqrif.vantaeclipse`) and its
  closing section says there is no audio.
* Both predate the Milestone 15+ art and audio work generally. Their *process*
  guidance — the staged testing plan, the device checklist, the regression
  paths — is still good and is the reason to keep them.

---

## 8. Google Play — what is actually left

The engineering is done. What remains is almost entirely account work,
paperwork, and one device.

### Hard blockers

**1. The privacy policy 404s.** `docs/privacy-policy.html` exists but GitHub
Pages is **off** — `https://kidriqrif.github.io/Vanta-Eclipse/privacy-policy.html`
returns 404, verified 2026-08-08. That blocks the Play Console field *and*
breaks the in-app Settings → Privacy button, which opens that exact URL
(`scripts/ui/settings_menu.gd`). The page also still carries a DRAFT banner and
a literal `[CONTACT EMAIL]` placeholder.
*Fix: repo Settings → Pages → main → `/docs`, then fill the two placeholders in
both `docs/privacy-policy.html` and `production/privacy-policy.md`.*

**2. Play Console forms.** Data Safety, IARC content rating, App access. The
Data Safety form is required even for an app that collects nothing — and this
one genuinely collects nothing: no account, no analytics, and no `HTTPRequest`
anywhere in the codebase. The only outbound action is `OS.shell_open()` handing
the privacy URL to the system browser, which is the OS opening a page, not the
app fetching anything.

**3. Rebuild the AAB.** The bundle on disk predates the art rework. Bump
`version/code` (Play rejects a repeat) and run
`bash tools/build_android.sh release`.

**4. Confirm the package name before first upload.** It is currently
`com.kidriqrif.vantaeclipse` and is **permanent once published**. If you own a
domain, use it instead.

**5. Back up the upload keystore somewhere you control.** Lose it and you can
never ship an update to an app signed with it. Enrol in Play App Signing when
you create the app.

### The two-week gate

If the developer account is a **personal** one created after 13 Nov 2023, Play
requires a closed test with **12 testers opted in for 14 continuous days**
before you can apply for production access. "Opted in" means they accepted the
invite *and installed* under the matching Google account — invited-but-not-
installed does not count. Organisation accounts and personal accounts created
before that date are exempt.

That is a two-week wall clock, not a form. **Start it as early as you can** —
everything else on this list can happen while it runs.

### Timing note, checked 2026-08-08

From **31 August 2026** new apps and updates must target **API 36**. The export
preset already targets 36, so this is satisfied — but it is three weeks out, so
do not let a submission slip past it with an older preset. Play also now
requires two-step verification on all Console accounts.

### What is NOT a blocker (corrections to the old handoff)

**The Shop's development banner does not ship.** `scripts/ui/shop.gd` gates it
on `USE_STUB_PROVIDERS and OS.is_debug_build()`, so a release build never shows
it. The old handoff listed this as blocker #2; it was fixed and the document was
not updated.

**Shipping with the stub providers is safe and correct.** With
`USE_STUB_PROVIDERS = true`, `PAID_SURFACES_AVAILABLE` is false, and that flag
is checked at every surface that could take money or claim to show an ad — the
Shop's offers tab and restore card, the Arcade's token offer, and the offline
doubler. There is no ad SDK and no Play Billing library in the bundle. The app
genuinely shows no ads and takes no money, so **declaring "No ads / No IAP" is
the truthful answer**, and `production/store-listing.md` already says so.

Do not declare IAP with no billing integration and no SKUs in Console — that
fails review.

### The one thing no amount of tooling here can replace

**Play it on a real Android phone.** The whole project has been verified
headless. A shader that compiles on desktop can still fail on a mobile GPU;
frame pacing, touch accuracy, battery draw, the back button and app lifecycle
are all unverified. `design/TESTING-GUIDE.md` Stage 2 covers this properly.
Build a debug APK first (`bash tools/build_android.sh debug`) — do not go
straight to an AAB.

Once you do upload to Internal Testing, **read the pre-launch report**. Google
runs the build on real physical devices automatically and reports crashes,
ANRs and rendering issues. For a project that has never run on hardware, that
is the single most valuable free signal available.

### Suggested order

1. Turn on GitHub Pages and fill the privacy-policy placeholders. *(minutes)*
2. Create the Play Console app; confirm the package name; enrol in Play App
   Signing. *(an hour)*
3. Build a debug APK, put it on a phone, play it. Fix what that turns up.
4. Rebuild the AAB, upload to Internal Testing, read the pre-launch report.
5. Fill Data Safety, IARC, App access, and the store listing from
   `production/store-listing.md`.
6. Open the closed test and recruit 12 testers — **the 14-day clock starts
   here**.
7. Apply for production access; staged rollout with crash monitoring.

### If monetisation is ever switched on

`MonetizationManager.USE_STUB_PROVIDERS = false` is not a one-line change. It
requires an AdMob plugin and an `AdProvider` implementation, a Play Billing
plugin and a `BillingProvider` implementation including `restore_purchases()`
(the Shop already calls it), **server-side receipt validation**, SKUs in
Console matching the `store_id` values in `data/products/`, and a rewritten
Data Safety form built from the ad SDK's own disclosure. Flip the store
listing's ads/IAP answers back to Yes in the same change.

Note the consequence of leaving it off: Astral Shards are earnable only from
three achievements — 120 + 150 + 150 = **420 total** — against **740** to buy
all five paid tap trails. Three of five are reachable; two are not.

---

## 9. Open, needing a human decision

- Enable GitHub Pages and fill the privacy-policy placeholders (§8 blocker 1).
- Confirm `com.kidriqrif.vantaeclipse` before first upload — permanent.
- Decide the text/device-pixel question (§7) — accept, letterbox, or re-author.
- Decide whether to add `x86_64` to the export so emulators and ChromeOS work.
- Astral Shards: 420 earnable vs 740 needed, so two cosmetics are unreachable
  while monetisation is stubbed. Either add a shard source or accept it.
- The game has **never run on a physical device**.
- `production/review-mode.txt` contains the single word `lean` and nothing
  reads it. Probably deletable.
