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

Fourteen sections are registered, one per owning manager. The set is verified
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

* Any system with persistent data calls
  `SaveManager.register_saveable("section_id", self)` in `_ready()` and
  implements `get_save_data()` / `load_save_data(data)`.
* Saving is automatic (every 60 s, on app close, on Android background) plus a
  manual button in Settings.
* Writes are **atomic**: temp file → backup current save → rename. A crash
  mid-save can never destroy progress; loading falls back to the backup.
* Format changes bump `SAVE_VERSION` and add one numbered step in
  `SaveManager._migrate()`. Old saves upgrade step by step to the newest format.
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

* Shared animated backdrop: `scenes/common/void_background.tscn`
  (nebula shader in `effects/` + drifting dust particles).
* Type: **Nunito** (`fonts/`, SIL OFL — safe for commercial use, license
  bundled), in three weights: 900 for display, 800 for anything pressable,
  700 for body. It replaced Cinzel, whose Roman-inscription capitals were the
  single biggest source of the old "fantasy serif" read.
* **Shape**: a large corner radius plus a thick *bottom* border reading as a
  pressable lip; pressed states shrink the lip and shift the content margin
  down, so the button sinks. Glow is a coloured `shadow_color` at a large
  `shadow_size` — `StyleBoxFlat`'s shadow is the only bloom available without
  a full-screen pass. Hierarchy is **filled primary, outlined secondary**.

### The colour system

This project has **five** independent colour systems, not one: the theme, the
rarity tiers (`rarity_style.gd`), the per-world nebula palettes
(`data/worlds/*.tres`), the enemy `glow_color`s, and the sprite shader's rim.
The first attempt at a restyle changed only the theme and produced a mess. Four
rules keep them coherent, and none of them is taste:

1. **One accent hue, used sparingly.** Never several saturated accents at equal
   weight. Everything else is a violet-tinted near-neutral ramp, so the brand
   is carried as a *tint* rather than as competing colour.
2. **The UI accent must not duplicate a game-world colour.** Rarity occupies
   198° Rare, 270° Epic, 43° Legendary, 347° Mythic; enemy glows add 142°,
   199–212° and 27°. A UI accent landing on one of those makes a button look
   like an item rarity. The accent sits at **308°** — the largest free gap,
   38° from Epic and 39° from Mythic.
3. **Desaturate for dark.** Every game colour is 92–96% saturated, which
   vibrates against dark surfaces. UI chrome stays well below that.
4. **Measure contrast, don't eyeball it.** Body text 15:1 on surface, dim text
   7:1, and the label on the accent button 7.4:1 (the 7:1 target for critical
   interactive text, above WCAG AA's 4.5:1).

Semantics deliberately **reuse** the game's own colours rather than inventing
more: the boss bar is elder-enemy orange, which is an association rather than a
collision, and the normal enemy bar is a rose desaturated 61 points below
Mythic so a large dull fill can never be mistaken for a small vivid rarity
label.
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
* A door's accent is scoped to that door and never mixes (Eclipse teal, Arcade
  lime). That includes the destination screen's own primary action, not just
  the button that leads there — the Arcade was lime everywhere except its four
  PLAY buttons, which came out in the global pink.

### Giving flat art depth

The sprites are SVGs — clean shapes with a crisp alpha silhouette and no
shading of their own. Rather than author a normal map per sprite,
`effects/dimensional_sprite.gdshader` **derives the surface normal from the
alpha channel**: the alpha gradient points into the shape, so its negation is
the direction the surface faces, and sampling that gradient several pixels out
turns a hard edge into a rounded bevel. That normal then drives Lambert
diffuse, a rim term, and a Blinn-Phong highlight.

This matters architecturally because it is *free to adopt*: any sprite in the
project gets lit by assigning `effects/dimensional_sprite_material.tres`, with
no new art and no per-sprite setup. The material is
`resource_local_to_scene`, so a screen may retint its uniforms without
affecting other users — `enemy_view.gd` retints `rim_color` per enemy from
`EnemyDefinition.glow_color`.

Two rules for anything that adopts it:

1. **Modify `COLOR` in place; never rebuild it from `TEXTURE`.** Whatever Godot
   put in `COLOR` already carries the node's modulate, so hit flashes, fades,
   and every `modulate` tween keep working. The shader relies on this.
2. **Light needs ground.** A lit sprite with no shadow reads as a sticker.
   Pair the material with a contact shadow (`resources/textures/soft_dot.tres`
   squashed into an ellipse) and counter-animate it against any hover — see
   `enemy_view.gd`, where the plate tightens and fades on the same curve as
   the bob.

Budget: 8 texture taps, no branches, no loops, one pass — sized for the
`mobile` renderer and low-end Android. `tools/check_shaders.py` guards the
parts that fail silently: a `shader_parameter` or `set_shader_parameter()`
naming a uniform that does not exist is discarded without an error anywhere.

## Conventions

* Files and folders: `snake_case` (Godot style guide). Node names: `PascalCase`.
* GDScript is fully typed (`var health: int = 10`, `-> void`).
* Every future save-format change needs a migration step — never break old saves.
* Mobile first: portrait 1080×1920 base resolution, `canvas_items` stretch with
  `expand` aspect, touch targets at least ~100 px tall.
* `TODO(Milestone N):` comments mark planned work and are searchable.
