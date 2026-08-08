# Vanta Eclipse — Architecture

This document explains how the project is organized and the rules every new
system must follow. It is the first thing to read before adding code.

## The manager (autoload) pattern

Godot lets us register scripts as **autoloads**: they are created once when the
game starts, never destroyed, and are reachable from any script by name.
All long-lived game logic lives in autoload managers under `scripts/managers/`.
Scenes (screens) are throwaway views: they read data from managers, display it,
and forward player input back to managers. **Scenes never own game state.**

Load order matters. This table is the declaration order in `project.godot` and
is verified against it by `tools/check_architecture.py` — if you add, remove, or
reorder an autoload, update this table in the same commit or the validation
sweep fails.

| Order | Autoload | File | Responsibility |
| --- | --- | --- | --- |
| 1 | `EventBus` | `event_bus.gd` | Global signals. No logic, no state. |
| 2 | `SettingsManager` | `settings_manager.gd` | Player preferences (`user://settings.cfg`), audio bus volumes, haptics. |
| 3 | `SaveManager` | `save_manager.gd` | Versioned JSON save file, autosave, atomic writes, migrations. |
| 4 | `GameManager` | `game_manager.gd` | Game version, play time, session count. Deliberately small &mdash; it does NOT pause: an idle game must keep running. |
| 5 | `CurrencyManager` | `currency_manager.gd` | All currency balances (essence, void crystals, astral shards). Only add()/try_spend() may change them. |
| 6 | `UpgradeManager` | `upgrade_manager.gd` | Upgrade definitions + owned levels; answers stat-modifier queries. |
| 7 | `EquipmentManager` | `equipment_manager.gd` | Inventory, equipped items, procedural generation, drops, salvage, forge. Ahead of `PlayerStats` so it can read the affix sums; items are serialized dicts, affix/slot pools are `.tres`. |
| 8 | `RelicManager` | `relic_manager.gd` | Relic collection, the active relic, and the awaken state. Ahead of `PlayerStats`/`IdleManager`, which read its effect-query getters. |
| 9 | `PetManager` | `pet_manager.gd` | Pet roster, active pet, XP/level/evolution. Ahead of `PlayerStats`, which reads its bonus getter. |
| 10 | `SkillTreeManager` | `skill_tree_manager.gd` | Ascendant Powers definitions and purchased levels. Ahead of `PlayerStats`. Powers are PERMANENT — they never reset on an Eclipse. |
| 11 | `PlayerStats` | `player_stats.gd` | All player combat stats behind `get_*()` functions; every layer above (upgrades, equipment, relics, pets, powers) stacks inside them. |
| 12 | `SceneManager` | `scene_manager.gd` | Scene switching with fade + threaded loading. Ahead of the combat managers so they may compare scene-path constants (M5). |
| 13 | `WorldManager` | `world_manager.gd` | World definitions, unlock progression (grandfather migration), palettes, essence multipliers. Never calls upward. |
| 14 | `CombatManager` | `combat_manager.gd` | Three-state combat machine (normal/boss/farm), gates, countdown, rewards, world-driven rosters. |
| 15 | `IdleManager` | `idle_manager.gd` | Auto-attack unlock/ticking, offline-reward eligibility and granting (priced at the effective farm level), app-resume hook. Its `enemy_spawned` connection order relative to CombatManager's `game_loaded` handler is load-bearing (see its comments). |
| 16 | `MinigameManager` | `minigame_manager.gd` | The Arcade: minigame definitions, the Arcade Token meter, per-game records, payout pricing. After `IdleManager`, whose live essence rate prices every reward. |
| 17 | `QuestManager` | `quest_manager.gd` | The Journal: quest chain, daily set, achievements. After `MinigameManager`, whose token grant it pays with. |
| 18 | `MonetizationManager` | `monetization_manager.gd` | Opt-in ad offers, purchases, entitlements, cosmetics. No mechanic is ever pay-gated (GDD stance, non-negotiable). |
| 19 | `PrestigeManager` | `prestige_manager.gd` | The Eclipse loop: run peak level, Void Crystal payout, and resetting the run-scoped managers. Loads last because it reaches across all of them. |
| 20 | `AudioManager` | `audio_manager.gd` | Every sound the game makes. Listens to `EventBus` and nothing else, so no screen asks for audio — which is why adding sound to a finished game changed no UI script. Loads last because it only ever reacts. The 15 effects and the drone are **synthesised** by `tools/make_audio.py` from a fixed seed, not sourced: regenerating is byte-identical, a tweak is an edit rather than a re-recording, and there are no asset licences to audit before release. |
| 21 | `CardManager` | `card_manager.gd` | Boss trophy cards: the rarity roll, the collection, and absorption into the active companion. Loads last because it reads `PetManager` and is read by nobody — a card only ever leaves the system through the pet it is fed to. |

## Art is generated, not drawn

Every visual asset comes out of a Python generator, from one closed 16-colour
palette declared once in `tools/pixelart.py`:

| Tool | Produces |
|---|---|
| `tools/pixelart.py` | The palette and a canvas that stores palette **names**, so a mistyped colour is a `KeyError` at generation time rather than wrong pixels. Writes PNGs by hand with `zlib`/`struct`. |
| `tools/make_sprites.py` | All 52 sprites — creatures, pets, minigame pieces, UI icons. `--sheet` writes contact sheets for review. |
| `tools/make_font.py` | `vanta_pixel` — a 5×7 monospace bitmap face, 106 glyphs, as BMFont `.fnt` + atlas. |
| `tools/make_icons.py` | Launcher, adaptive, store icon and feature graphic. |
| `tools/make_audio.py` | All 15 effects and the drone. |
| `tools/snap_palette.py` | Moves any stray colour onto the nearest palette entry. Idempotent. |

Three rules hold it together, and each exists because breaking it produced a
visible bug:

* **Nothing scales by a fraction.** Sprites, font sizes and icons are all
  integer multiples of what was authored. **Every** font size in the project
  is a multiple of 9 — the glyph box — because vanta_pixel is a bitmap face
  that exists at 9px and nowhere else, so any other size is Godot resampling
  the atlas. The icon grids are 32 and 27 because 512/192/432 divide by them.
  The revamp converted the theme and left the scenes and scripts on their
  Nunito-era values, so 135 of 145 sizes were resampling on a "finished"
  restyle; `tools/snap_font_sizes.py` fixes them and `check_ui.py` fails the
  sweep on any that come back.
* **Surfaces are flat.** No corner radii, no soft shadows, no gradients — each
  needs colours between the ones the palette gives it. A falloff is spelled as
  solid pixels at falling density (`ground_glow()`) or as hard steps
  (`menu_divider()`). `check_ui.py` fails the sweep on all three.
* **`void` is the background, never a fill.** A void-filled body is not a dark
  shape, it is a hole.
* **The palette is closed.** `check_ui.py` fails the sweep on any UI colour
  that is not one of the sixteen, `check_pixels.py` fails it on any *pixel* of
  any shipped PNG that is not one of the sixteen — 1.3M pixels across 59
  images, which no source-file scan can see — and `check_glyphs.py` fails it
  on any rendered character the font has no glyph for.

## Communication rules

1. **UI → manager**: direct calls (`SettingsManager.music_volume = 0.5`).
2. **Manager → anyone**: signals on `EventBus`, never direct references to
   scenes. Managers must work even when no UI exists.
3. **System → system**: prefer `EventBus` signals. For direct calls the rule is
   about *when*, not merely direction:
   * **Inside `_ready()`** an autoload may only touch autoloads above it — the
     ones below do not exist yet. `tools/check_scripts.py` enforces this.
   * **At runtime** every autoload exists, so a call in either direction is
     safe. Upward calls are still the exception and should earn their place:
     today only `SaveManager` → `GameManager.GAME_VERSION` (a `const`, read
     while building the save document) and `QuestManager` →
     `PrestigeManager.lifetime_peak_level` (a goal-metric snapshot).

This is what keeps the codebase scalable: a new system can be added by creating
a manager, registering a save section, and emitting/listening on the EventBus —
without editing existing systems.

## Save system

The save file (`user://savegame.json`) is one versioned JSON document:

```json
{
    "save_version": 1,
    "game_version": "0.1.0",
    "saved_at_unix": 1789000000,
    "sections": {
        "game": { "total_play_time": 123.4, "launch_count": 2, "created_at_unix": 1789000000 },
        "combat": { "enemy_level": 14, "total_kills": 13 },
        "currencies": { "essence": 250.0, "void_crystals": 0.0, "astral_shards": 0.0 },
        "upgrades": { "void_claws": 5, "dark_focus": 2 }
    }
}
```

Fifteen sections are registered, one per owning manager. The set is verified
against the code by `tools/check_architecture.py`:

| Section | Owner | Section | Owner |
| --- | --- | --- | --- |
| `game` | `GameManager` | `relics` | `RelicManager` |
| `currencies` | `CurrencyManager` | `pets` | `PetManager` |
| `upgrades` | `UpgradeManager` | `skills` | `SkillTreeManager` |
| `equipment` | `EquipmentManager` | `arcade` | `MinigameManager` |
| `world` | `WorldManager` | `journal` | `QuestManager` |
| `combat` | `CombatManager` | `shop` | `MonetizationManager` |
| `idle` | `IdleManager` | `prestige` | `PrestigeManager` |
| `cards` | `CardManager` | | |

* Any system with persistent data calls
  `SaveManager.register_saveable("section_id", self)` in `_ready()` and
  implements `get_save_data()` / `load_save_data(data)`.
* Saving is automatic (every 60 s, on app close, on Android background) plus a
  manual button in Settings.
* Writes are **atomic**: temp file → backup current save → rename. A crash
  mid-save can never destroy progress; loading falls back to the backup.
* Format changes bump `SAVE_VERSION` and add one numbered step in
  `SaveManager._migrate()`. Old saves upgrade step by step to the newest format.
* Saves from a **newer** build are refused, never downgraded, and copied to
  `user://savegame.from_vN.json` first. Loading one would hand new-format
  sections to old code and relabel them as old-format, so the next update would
  migrate already-migrated data and destroy the run — and refusing without
  keeping a copy would be just as bad, because the 60 s autosave overwrites the
  file we declined to read.
* `saved_at_unix` is the anchor for offline progression (Milestone 4).
* Cloud saves (Milestone 15) will upload `SaveManager.get_full_save_text()`.

Settings are deliberately **not** part of the save file so they survive
prestige resets and save deletion.

## Adding a new screen

1. Create `scenes/<screen_name>/<screen_name>.tscn` with a `Control` root and
   the shared theme `ui/theme/main_theme.tres`.
2. Create its script in `scripts/ui/` — display logic only.
3. Add a `SCENE_<NAME>` constant in `scene_manager.gd`.
4. Navigate with `SceneManager.change_scene(SceneManager.SCENE_<NAME>)`.

## Content as data

Game content lives in Resource files (`.tres`), not code. Enemies are
`EnemyDefinition` resources in `data/enemies/` — adding an enemy means adding
one `.tres` file and one sprite, zero code changes. Shop upgrades are
`UpgradeDefinition` resources in `data/upgrades/` and the shop UI builds
itself from them. Equipment, relics, and pets will follow the same pattern.

## Balancing

Combat/economy curves are tuned by simulation, not gut feeling — see the
constants in `combat_manager.gd`. Current tuning (active tapping, greedy
upgrade buying): level 30 in ~1.5 min, level 50 at ~8 min, level 60 at
~19 min, soft wall near level 70 that idle mechanics (Milestone 4) relieve.
Enemy health grows 15%/level while essence rewards grow 9%/level — that
widening gap is what makes upgrades feel necessary.

Idle/offline (Milestone 4): auto-attack ticks at 1.0s (one third of active
tapping speed) once unlocked at enemy level 15. Offline pay mirrors the
real auto-attack kill rate at the player's current stats, at 50%
efficiency (`PlayerStats.get_offline_multiplier`), capped at 8 hours —
both values are deliberate upgrade hooks for prestige and rewarded ads.
Enemy level never advances while away: the player returns to essence, not
to a wall.

Loot (Milestone 6, tuned via scratchpad loot_sim.py): 3% drop on normal
kills, guaranteed on bosses (weights 30/40/22/7/1), world bosses min-Epic
(0/0/60/32/8), normal weights 74/20/5/0.9/0.1. Affix magnitudes anchor to
the upgrade curve (flat rolls ~L x 0.06-0.18 x rarity), giving full gear
~1.45x dps — acceleration, never a gate. Salvage 2/5/12/30/75 scraps by
rarity; forge pull costs 20 (~first pull at 30-40 min).

Bosses (Milestone 5, tuned via scratchpad boss_sim.py): every 10th level,
3x HP, 30s timer (1.1s entrance grace), 10x payout. Gates 10-40 are
beatable on arrival with escalating tension; the level-50 world boss is a
~6-minute farm wall; Frozen Ruins pays 2.5x essence. Deep-world walls
(L60+) are intentionally brutal until equipment/relics/prestige land.

## Visual identity

The style is **pixel-art roguelike**: hard edges, a closed palette, and nothing
that scales by a fraction.

* Backdrop: `scenes/common/void_background.tscn`, a single flat `ColorRect`.
  It used to be a nebula shader with drifting dust; that was removed, and its
  removal is what finally exposed a violet gradient divider that had survived
  an entire palette pass by blending into the animation behind it.
* Type: **`vanta_pixel`** (`fonts/`), a 5×7 monospace bitmap face generated by
  `tools/make_font.py`. Monospace because a roguelike is a grid and because
  numbers that change every frame must not jitter as their digits change
  width. It replaced Nunito, a rounded humanist sans — the last thing in the
  project that read as a modern mobile app.
* **Shape**: every corner radius is **0**. A rounded rectangle carries an
  anti-aliased arc, which is the one thing hard-edged sprites cannot sit
  beside. Hierarchy is **filled primary, outlined secondary**.

### The colour system

One **closed 16-colour palette**, declared once in `tools/pixelart.py` and used
by everything: sprites, font atlas, theme, icons, rarity tiers, enemy glows.

That is the change. The project previously ran *five* independent colour
systems and kept them coherent by rule — one accent hue, a measured 308° gap
from the nearest rarity, a saturation ceiling for dark surfaces. Those rules
worked, and they were necessary because nothing enforced coherence
mechanically. A closed palette enforces it by construction: there is no
"nearly right" colour available to reach for.

Seven neutrals do structure (background → panel → row → border → muted →
body → title) and nine hues do meaning (element, rarity, currency, danger).

* Rarity is a **hue** ladder — ash, frost, violet, gold, crimson. It was a
  brightness ramp, which is what a single-accent scheme wanted; snapping that
  ramp onto sixteen colours put Rare and Epic on the *same* neutral, because
  the palette carries seven neutrals and four are darker than any text. Tier
  is still carried by pip **count**, so it stays colour-blind safe.
* `tools/snap_palette.py` moves any stray colour to its nearest palette entry,
  and `check_ui.py` fails the sweep on anything that is not an exact match.
  That check replaced a hue-arc rule which was both too loose (any red, not
  *the* red) and structurally blind to the failure that matters most — two
  greys one step apart have no chroma, so an arc skips them entirely.
* Note that `design/ux/milestone-*.md` predate this restyle and describe the
  Cinzel-era treatment. They are kept as the design record of each
  milestone; `main_theme.tres` is the authority on what actually ships.
* All widget styling comes from `ui/theme/main_theme.tres`. Theme
  *variations* (`PrimaryButton`, `TitleLabel`, `HeaderLabel`) give screens a
  consistent look — set `theme_type_variation` on a node instead of
  hand-overriding fonts and colors.
* Every full screen names itself with a `TitleLabel` node carrying the
  `TitleLabel` variation. Six screens had drifted onto `HeaderLabel` — the
  muted *secondary text* role — so half the game announced itself in dim grey
  body text. Each scene looked deliberate on its own; only side by side was it
  obviously an accident. `tools/check_ui.py` now fails the sweep on it.
* Sliding overlays (Forge, Relics, Upgrade shop) take the `OverlayPanel`
  variation, not the default `PanelContainer`. They cover the screen behind
  them rather than floating over a scrim, so they must be fully opaque; at the
  shared 0.92 alpha the Gear inventory showed straight through the Forge's own
  header and read as a rendering fault.
* A StyleBox that Godot sizes from its own minimum size — `HSlider`'s track and
  fill — **needs explicit `content_margin_top`/`bottom`**, or it draws at zero
  height. Without them the three Settings volume sliders rendered as a single
  4px dot: the styles *were* assigned, so the theme looked complete while the
  screen was empty. Also checked by `check_ui.py`.
* **One accent, spent not sprayed.** The scheme is red on true-neutral black.
  Red marks the primary action, the active state and danger, and nothing else;
  everything the player is not currently being asked to do is neutral. That
  restraint is most of what reads as "minimal" — the previous theme put its
  accent on every border, title and pill at once.
* The bright accent (`#FF3B30`) and the deep accent (`#A8101A`) are two jobs,
  not two shades. The first has to be READ against black (5.4:1), the second
  read THROUGH by white text on top of it (7.6:1). No single red clears both.
* **Per-door accents are retired.** Eclipse teal and Arcade lime were two extra
  neon hues on the busiest row in the game. Doors are told apart by icon and
  label, which is what players navigate by. Rarity is likewise a VALUE ladder
  now — grey to near-white — with chroma only on Mythic, which is safe because
  `make_pip_row()` has always carried the tier by pip count.
* Colour in the game world follows the same rule: ordinary enemies glow pale,
  and only bosses burn red. Nebula backdrops are near-black, separated by
  temperature and value rather than hue.
* Every screen is a full-bleed background plus a root `MarginContainer` holding
  all the UI. Keep that shape: `SceneManager` insets **that node** by the
  display safe area, so a notch or gesture bar pushes the controls in while the
  nebula still reaches the display edge. A screen that puts UI outside the
  MarginContainer will sit under the system chrome on most current phones.
* Layout is tuned against 1080x1920 because `stretch/aspect="expand"` only ever
  *grows* the viewport — that base is both the narrowest and the shortest case
  any Android device produces, so what fits there fits everywhere.
  `tools/aspect_matrix.sh` proves it across seven device shapes.

### Where the shading lives

The sprites are indexed pixel art: a 64×64 PNG whose every pixel is one of the
sixteen palette colours, drawn with its own lit/mid/shadow ramp already in it
(`tools/make_sprites.py`). **The art is shaded; the shader is not.** That is
the inversion from the previous style and it is the whole architecture of this
layer.

Before the revamp the sprites were SVGs — smooth shapes with no shading of
their own — and **dimensional_sprite.gdshader** (deleted) supplied all of it,
deriving a fake surface normal from the alpha gradient and running Lambert
diffuse, a rim term and a Blinn-Phong highlight over it. That shader was correct for 512px
vector art and actively destructive here: on a 64px sprite scaled 8× it
averaged a seven-texel bevel across pixels that were the image, then
desaturated the result against a 0.42 grey ambient. The first pixel-art render
came out a blurred grey smudge, and the sprites were not the reason.

`effects/pixel_sprite.gdshader` replaced it and does one thing: a hard
**one-texel outline** in the creature's own colour, so the silhouette stays off
the background. It measures that texel with `TEXTURE_PIXEL_SIZE`, which is in
UV units of the *source* image, so the halo is one source pixel thick at any
scale and never drifts off the art's own grid. Adoption is still free — assign
`effects/pixel_sprite_material.tres` — and the material is still
`resource_local_to_scene`, so `enemy_view.gd` retints `rim_color` per enemy
from `EnemyDefinition.glow_color`. The uniform kept its old name precisely so
that call site did not have to change.

Two rules for anything that adopts it:

1. **Modify `COLOR` in place; never rebuild it from `TEXTURE`.** Whatever Godot
   put in `COLOR` already carries the node's modulate, so hit flashes, fades,
   and every `modulate` tween keep working. The shader relies on this.
2. **A creature needs ground.** A sprite with nothing under it reads as a
   sticker. Pair it with `sprites/ui/ground_glow.png` — a dithered pool, not a
   blurred ellipse — and counter-animate it against any hover; see
   `enemy_view.gd`, where the pool tightens and fades on the same curve as the
   bob.

Budget: 5 texture taps, one branch, no loops, one pass — sized for the `mobile`
renderer and low-end Android. `tools/check_shaders.py` guards the parts that
fail silently: a `shader_parameter` or `set_shader_parameter()` naming a
uniform that does not exist is discarded without an error anywhere.

## Conventions

* Files and folders: `snake_case` (Godot style guide). Node names: `PascalCase`.
* GDScript is fully typed (`var health: int = 10`, `-> void`).
* Every future save-format change needs a migration step — never break old saves.
* Mobile first: portrait 1080×1920 base resolution, `canvas_items` stretch with
  `expand` aspect, touch targets at least ~100 px tall.
* `TODO(Milestone N):` comments mark planned work and are searchable.
